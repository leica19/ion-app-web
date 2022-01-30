import React, { useEffect, useRef, useState, forwardRef } from "react";
import {
  Layout,
  Button,
  Modal,
  Icon,
  notification,
  Card,
  Spin,
  Tooltip,
} from "antd";
const { confirm } = Modal;
const { Header, Content, Footer, Sider } = Layout;
import { reactLocalStorage } from "reactjs-localstorage";
import MicrophoneIcon from "mdi-react/MicrophoneIcon";
import MicrophoneOffIcon from "mdi-react/MicrophoneOffIcon";
import HangupIcon from "mdi-react/PhoneHangupIcon";
import TelevisionIcon from "mdi-react/TelevisionIcon";
import TelevisionOffIcon from "mdi-react/TelevisionOffIcon";
import VideoIcon from "mdi-react/VideoIcon";
import VideocamOffIcon from "mdi-react/VideocamOffIcon";
import MediaSettings from "./settings";
import ToolShare from "./ToolShare";
import ChatFeed from "./chat/index";
import Message from "./chat/message";
import "../styles/css/app.scss";

import LoginForm from "./LoginForm";
import Conference from "./Conference";
//@see https://github.com/pion/ion-sdk-js/blob/master/src/connector/room.ts
import * as Ion from "ion-sdk-js/lib/connector";
import { v4 as uuidv4 } from "uuid";

const ForwardRefConference = forwardRef(Conference);

function App() {

  const conference = useRef(null);

  const [login, setLogin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [localAudioEnabled, setLocalAudioEnabled] = useState(true);
  const [localVideoEnabled, setLocalVideoEnabled] = useState(true);
  const [screenSharingEnabled, setScreenSharingEnabled] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [vidFit, setVidFit] = useState(false);
  const [loginInfo, setLoginInfo] = useState({});
  const [messages, setMessages] = useState([]);
  const [sid, setSid] = useState('');
  const [uid, setUid] = useState(uuidv4());
  const [peers, setPeers] = useState([]);
  const [connector, setConnector] = useState(null);
  const [room, setRoom] = useState(null);
  const [rtc, setRTC] = useState(null);

  let settings = {
    selectedAudioDevice: "",
    selectedVideoDevice: "",
    resolution: "vga",
    bandwidth: 512,
    codec: "vp8",
    isDevMode: false,
  };

  useEffect(() => {
    let _settings = reactLocalStorage.getObject("settings");
    if (_settings.codec !== undefined) {
      settings = _settings;
    }
    return () => {
      cleanUp();
    };
  }, []);

  const cleanUp = async () => {
    await conference.current.cleanUp();
    window.location.reload();
  };

  const notificationTip = (message, description) => {
    notification.info({
      message: message,
      description: description,
      placement: "bottomRight",
    });
  };

  const handleJoin = async (values) => {

    setLoading(true);
    // open chat window
    // openOrCloseLeftContainer(!collapsed);
    let url = window.location.protocol + "//" + window.location.hostname + ":" + "5551";
    // +   window.location.port;
    // Note if you're running this inside docker you'll need to remove the ":5551" and possibly add the following line so that caddy can proxy correctly
    // + window.location.port;

    //  console.log("Connect url:" + url);

    let connector = new Ion.Connector(url, "token");

    setConnector(connector);

    let room = new Ion.Room(connector);
    let rtc = new Ion.RTC(connector);
    setRoom(room);
    setRTC(rtc);

    // @see https://github.com/pion/ion-sdk-js/blob/master/src/connector/room.ts
    room.onjoin = (success, reason) => {
      console.log("onjoin: success=", success, ", reason=", reason);
      // console.log("when onlogin: uid = " + uid);
      onJoin(values, sid, uid); // sid = room.id
    };

    // @see https://github.com/pion/ion-sdk-js/blob/master/src/connector/room.ts
    room.onleave = (reason) => {
       console.log("room.onleave");
    };

    room.onpeerevent = (ev) => {

      console.log("room.onpeerevent");

      // console.log(
      //   "[onpeerevent]: state = ",
      //   ev.state,
      //   ", peer = ",
      //   ev.peer.uid,
      //   ", name = ",
      //   ev.peer.displayname
      // );

//       export enum PeerState {
//     NONE,
//     JOIN,
//     UPDATE,
//     LEAVE,
// }

      if (ev.state == Ion.PeerState.JOIN) {
        notificationTip(
          "Peer Join",
          "peer => " + ev.peer.displayname + ", が参加しました。"
        );
        onSystemMessage(ev.peer.displayname + ", が参加しました。");
      } else if (ev.state == Ion.PeerState.LEAVE) {
        notificationTip(
          "Peer Leave",
          "peer => " + ev.peer.displayname + ", 退出しました。"
        );
        onSystemMessage(ev.peer.displayname + ", が退出しました。");
      }

      let peerInfo = {
        uid: ev.peer.uid,
        name: ev.peer.displayname,
        state: ev.state,
      };
      let _peers = peers;
      let find = false;
      _peers.forEach((item) => {
        if (item.uid == ev.peer.uid) {
          item = peerInfo;
          find = true;
        }
      });
      if (!find) {
        _peers.push(peerInfo);
      }
      // // console.log("setPeers peers= ", peers);
      setPeers([..._peers]);

    };

    // メッセージ取得
    room.onmessage = (msg) => {
      const uint8Arr = new Uint8Array(msg.data);
      const decodedString = String.fromCharCode.apply(null, uint8Arr);
      const json = JSON.parse(decodedString);
      // console.log("onmessage msg= ", msg, "json= ", json);
      let _messages = messages;
      if (uid != msg.from) {
        let _uid = 1;
        _messages.push(
          new Message({
            id: _uid,
            message: json.msg.text,
            senderName: json.msg.name,
          })
        );
        // console.log("setMessages msg= ", _messages);
        setMessages([..._messages]);
      }
    };

    room
      .join(
        {
          sid: values.roomId, // foom value
          uid: uid, // uuidをjoinへセット(uuidv4)
          displayname: values.displayName,
          extrainfo: "",
          destination: "webrtc://ion/peer1",
          role: Ion.Role.HOST,
          protocol: Ion.Protocol.WEBRTC,
          avatar: "string",
          direction: Ion.Direction.INCOMING,
          vendor: "string",
        },
        ""
      )
      .then((result) => {

        //  console.log(
        //   "[join] result: success " +
        //   result?.success +
        //   ", room info: " +
        //   JSON.stringify(result?.room)
        // );

        if (!result?.success) {
          // console.log("[join] failed: " + result?.reason);
          return
        }

        rtc.ontrackevent = function (ev) {

          // console.log(
          //   "[ontrackevent]: \nuid = ",
          //   ev.uid,
          //   " \nstate = ",
          //   ev.state,
          //   ", \ntracks = ",
          //   JSON.stringify(ev.tracks)
          // );

          let _peers = peers;
          _peers.forEach((item) => {
            ev.tracks.forEach((track) => {
              // track = MediaStreamTrack
              // ref: https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack
              // MediaStreamTrack.id = track.id = GUID(e.g. de8a2a16-9f93-4e64-9522-65f24d6eaa61)
              // MediaStreamTrack.id = "video|audio"
              if (item.uid == ev.uid && track.kind == "video") {
                // console.log("MediaStreamTrack =", track)
                item["id"] = JSON.stringify(ev.tracks)[0].id;
                item["id"] = track.stream_id;
                // console.log("ev.streams[0].id:::" + item["id"]);
              }
            });
          });

          setPeers([..._peers]);
        };

        rtc.ondatachannel = ({ channel }) => {
          // console.log("[ondatachannel] channel=", channel);
          channel.onmessage = ({ data }) => {
            // console.log("[ondatachannel] channel onmessage =", data);
          };
        };

        rtc.join(values.roomId, uid)
        // console.log("rtc.join")

      });

    window.onunload = async () => {
      await cleanUp();
    };
  };

  // @values ログインのform parameters
  const onJoin = async (values, sid, uid) => {

    // ログイン情報をローカルストレージに保存
    reactLocalStorage.remove("loginInfo");
    reactLocalStorage.setObject("loginInfo", values);

    setLogin(true);
    setLoading(false);
    setSid(sid); // room.id
    setUid(uid);
    setLoginInfo(values);
    setLocalVideoEnabled(!values.audioOnly);

    conference.current.handleLocalStream(true);

    notificationTip(
      "入室に成功しました",
      "ルームID => " + values.roomId
    );

  };

  const handleLeave = async () => {
    confirm({
      title: "",
      content: "本当に退室しますか？",
      async onOk() {
        await cleanUp();
        setLogin(false);
      },
      onCancel() {
        // console.log("Cancel");
      },
    });
  };

  const handleAudioTrackEnabled = (enabled) => {
    setLocalAudioEnabled(enabled);
    conference.current.muteMediaTrack("audio", enabled);
  };

  const handleVideoTrackEnabled = (enabled) => {
    setLocalVideoEnabled(enabled);
    conference.current.muteMediaTrack("video", enabled);
  };

  const handleScreenSharing = (enabled) => {
    setScreenSharingEnabled(enabled);
    conference.current.handleScreenSharing(enabled);
  };

  const openOrCloseLeftContainer = (collapsed) => {
    setCollapsed(collapsed);
  };

  const onVidFitClickHandler = () => {
    setVidFit(!vidFit);
  };

  const onFullScreenClickHandler = () => {
    let docElm = document.documentElement;

    if (fullscreenState()) {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.webkitCancelFullScreen) {
        document.webkitCancelFullScreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }

      setIsFullScreen(false);
    } else {
      if (docElm.requestFullscreen) {
        docElm.requestFullscreen();
      }
      //FireFox
      else if (docElm.mozRequestFullScreen) {
        docElm.mozRequestFullScreen();
      }
      //Chrome
      else if (docElm.webkitRequestFullScreen) {
        docElm.webkitRequestFullScreen();
      }
      //IE11
      else if (elem.msRequestFullscreen) {
        elem.msRequestFullscreen();
      }
      setIsFullScreen(true);
    }
  };

  const fullscreenState = () => {
    return (
      document.fullscreen ||
      document.webkitIsFullScreen ||
      document.mozFullScreen ||
      false
    );
  };

  const onMediaSettingsChanged = (
    selectedAudioDevice,
    selectedVideoDevice,
    resolution,
    bandwidth,
    codec,
    isDevMode
  ) => {
    settings = {
      selectedAudioDevice,
      selectedVideoDevice,
      resolution,
      bandwidth,
      codec,
      isDevMode,
    };
    reactLocalStorage.setObject("settings", this._settings);
  };

  const onSendMessage = (msg) => {
    let info = reactLocalStorage.getObject("loginInfo");

    // console.log("broadcast to room: ", info.roomId, " message: " + msg);

    var data = {
      uid: uid,
      name: loginInfo.displayName,
      text: msg,
    };
    let map = new Map();
    map.set('msg', data);
    room.message(info.roomId, uid, "all", 'Map', map);
    let _messages = messages;
    let _uid = 0;
    _messages.push(new Message({ id: _uid, message: msg, senderName: "me" }));
    setMessages([..._messages]);
  };

  const onSystemMessage = (msg) => {
    let _messages = messages;
    let _uid = 2;
    _messages.push(
      new Message({ id: _uid, message: msg, senderName: "System" })
    );
    setMessages([..._messages]);
  };

  const onScreenSharingClick = (enabled) => {
    setScreenSharingEnabled(enabled);
  };

  return (
    <Layout className="app-layout">
      <Header className="app-header">
        <div className="app-header-left">
          <p>N:N SFU検証</p>
        </div>
        {login ? (
          <div className="app-header-tool">
            <Tooltip title="Mute/Cancel">
              <Button
                ghost
                size="large"
                style={{ color: localAudioEnabled ? "" : "red" }}
                type="link"
                onClick={() => handleAudioTrackEnabled(!localAudioEnabled)}
              >
                <Icon
                  component={
                    localAudioEnabled ? MicrophoneIcon : MicrophoneOffIcon
                  }
                  style={{ display: "flex", justifyContent: "center" }}
                />
              </Button>
            </Tooltip>
            <Tooltip title="Open/Close video">
              <Button
                ghost
                size="large"
                style={{ color: localVideoEnabled ? "" : "red" }}
                type="link"
                onClick={() => handleVideoTrackEnabled(!localVideoEnabled)}
              >
                <Icon
                  component={localVideoEnabled ? VideoIcon : VideocamOffIcon}
                  style={{ display: "flex", justifyContent: "center" }}
                />
              </Button>
            </Tooltip>
            <Tooltip title="Hangup">
              <Button
                shape="circle"
                ghost
                size="large"
                type="danger"
                style={{ marginLeft: 16, marginRight: 16 }}
                onClick={handleLeave}
              >
                <Icon
                  component={HangupIcon}
                  style={{ display: "flex", justifyContent: "center" }}
                />
              </Button>
            </Tooltip>
            <Tooltip title="Share desktop">
              <Button
                ghost
                size="large"
                type="link"
                style={{ color: screenSharingEnabled ? "red" : "" }}
                onClick={() => handleScreenSharing(!screenSharingEnabled)}
              >
                <Icon
                  component={
                    screenSharingEnabled ? TelevisionOffIcon : TelevisionIcon
                  }
                  style={{ display: "flex", justifyContent: "center" }}
                />
              </Button>
            </Tooltip>
            <ToolShare loginInfo={loginInfo} />
          </div>
        ) : (
          <div />
        )}
        <div className="app-header-right">
          <MediaSettings
            onMediaSettingsChanged={onMediaSettingsChanged}
            settings={settings}
          />
        </div>
      </Header>

      <Content className="app-center-layout">
        {login ? (
          <Layout className="app-content-layout">
            <Sider
              width={320}
              style={{ background: "#333" }}
              collapsedWidth={0}
              trigger={null}
              collapsible
              collapsed={collapsed}
            >
              <div className="left-container">
                <ChatFeed messages={messages} onSendMessage={onSendMessage} />
              </div>
            </Sider>
            <Layout className="app-right-layout">
              <Content style={{ flex: 1 }}>
                <ForwardRefConference
                  uid={uid}
                  sid={sid} // room id
                  collapsed={collapsed}
                  connector={connector}
                  room={room}
                  rtc={rtc}
                  settings={settings}
                  peers={peers}
                  localAudioEnabled={localAudioEnabled}
                  localVideoEnabled={localVideoEnabled}
                  screenSharingClick={onScreenSharingClick}
                  vidFit={vidFit}
                  ref={conference}
                />
              </Content>
              <div className="app-collapsed-button">
                <Tooltip title="Open/Close chat panel">
                  <Button
                    icon={collapsed ? "right" : "left"}
                    size="large"
                    shape="circle"
                    ghost
                    onClick={() => openOrCloseLeftContainer(!collapsed)}
                  />
                </Tooltip>
              </div>
              <div className="app-fullscreen-layout">
                <Tooltip title="Fit/Stretch Video">
                  <Button
                    icon={vidFit ? "minus-square" : "plus-square"}
                    size="large"
                    shape="circle"
                    ghost
                    onClick={() => onVidFitClickHandler()}
                  />
                </Tooltip>
                <Tooltip title="Fullscreen/Exit">
                  <Button
                    icon={isFullScreen ? "fullscreen-exit" : "fullscreen"}
                    size="large"
                    shape="circle"
                    className="app-fullscreen-button"
                    ghost
                    onClick={() => onFullScreenClickHandler()}
                  />
                </Tooltip>
              </div>
            </Layout>
          </Layout>
        ) : loading ? (
          // 接続中
          <Spin size="large" tip="接続中..." />
        ) : (
          // 未入室
          <Card title="N:N SFU" className="app-login-card">
            <LoginForm handleLogin={handleJoin} />
          </Card>
        )}
      </Content>

      {!login && (
        <Footer className=".app-footer">
          <p>Powerd by unexplainable anger</p>
        </Footer>
      )}
    </Layout>
  );
}

export default App;
