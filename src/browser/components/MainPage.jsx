// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// This files uses setState().
/* eslint-disable react/no-set-state */

import url from 'url';

import React from 'react';
import PropTypes from 'prop-types';
import {CSSTransition, TransitionGroup} from 'react-transition-group';
import {Grid, Row} from 'react-bootstrap';

import {ipcRenderer, remote} from 'electron';

import LoginModal from './LoginModal.jsx';
import MattermostView from './MattermostView.jsx';
import TabBar from './TabBar.jsx';
import HoveringURL from './HoveringURL.jsx';
import Finder from './Finder.jsx';
import NewTeamModal from './NewTeamModal.jsx';
import SettingsModal from './SettingsPage.jsx';

export default class MainPage extends React.PureComponent {
  constructor(props) {
    super(props);

    let key = this.props.initialIndex;
    if (this.props.deeplinkingUrl !== null) {
      const parsedDeeplink = this.parseDeeplinkURL(this.props.deeplinkingUrl);
      if (parsedDeeplink) {
        key = parsedDeeplink.teamIndex;
      }
    }

    this.state = {
      key,
      sessionsExpired: new Array(this.props.teams.length),
      unreadCounts: new Array(this.props.teams.length),
      mentionCounts: new Array(this.props.teams.length),
      unreadAtActive: new Array(this.props.teams.length),
      mentionAtActiveCounts: new Array(this.props.teams.length),
      loginQueue: [],
      targetURL: '',
      showSettingsModal: this.props.teams.length === 0,
      teams: this.props.teams,
    };
  }

  parseDeeplinkURL(deeplink, teams = this.state.teams) {
    if (deeplink && Array.isArray(teams) && teams.length) {
      const deeplinkURL = url.parse(deeplink);
      let parsedDeeplink = null;
      teams.forEach((team, index) => {
        const teamURL = url.parse(team.url);
        if (deeplinkURL.host === teamURL.host) {
          parsedDeeplink = {
            teamURL,
            teamIndex: index,
            originalURL: deeplinkURL,
            url: `${teamURL.protocol}//${teamURL.host}${deeplinkURL.pathname}`,
            path: deeplinkURL.pathname,
          };
        }
      });
      return parsedDeeplink;
    }
    return null;
  }

  getTabWebContents(index = this.state.key || 0, teams = this.props.teams) {
    if (!teams || !teams.length || index > teams.length) {
      return null;
    }
    const tabURL = teams[index].url;
    if (!tabURL) {
      return null;
    }
    return remote.webContents.getAllWebContents().find((webContents) => webContents.getURL().includes(tabURL));
  }

  focusListener = () => {
    this.handleOnTeamFocused(this.state.key);
    if (this.refs[`mattermostView${this.state.key}`]) {
      this.refs[`mattermostView${this.state.key}`].focusOnWebView();
    }
  }

  componentDidMount() {
    const {config} = this.props;

    config.on('update', (data) => {
      this.setState({teams: data.teams, key: data.teams.length - 1});
    });

    ipcRenderer.on('login-request', (event, request, authInfo) => {
      this.setState({
        loginRequired: true,
      });
      const loginQueue = this.state.loginQueue;
      loginQueue.push({
        request,
        authInfo,
      });
      this.setState({
        loginQueue,
      });
    });

    ipcRenderer.on('toggle-settings-page', (_e, tabIndex) => {
      const {showSettingsModal, teams} = this.state;
      if (teams.length === 0) {
        return;
      }
      this.setState({showSettingsModal: !showSettingsModal, key: Number.isInteger(tabIndex) ? tabIndex : this.state.key});
    });

    // can't switch tabs sequentially for some reason...
    ipcRenderer.on('switch-tab', (event, key) => {
      this.handleSelect(key);
    });
    ipcRenderer.on('select-next-tab', () => {
      this.handleSelect(this.state.key + 1);
    });
    ipcRenderer.on('select-previous-tab', () => {
      this.handleSelect(this.state.key - 1);
    });

    // reload the activated tab
    ipcRenderer.on('reload-tab', () => {
      this.refs[`mattermostView${this.state.key}`].reload();
    });
    ipcRenderer.on('clear-cache-and-reload-tab', () => {
      this.refs[`mattermostView${this.state.key}`].clearCacheAndReload();
    });

    const currentWindow = remote.getCurrentWindow();
    currentWindow.on('focus', this.focusListener);
    window.addEventListener('beforeunload', () => {
      currentWindow.removeListener('focus', this.focusListener);
    });

    // https://github.com/mattermost/desktop/pull/371#issuecomment-263072803
    currentWindow.webContents.on('devtools-closed', this.focusListener);

    ipcRenderer.on('open-devtool', () => {
      document.getElementById(`mattermostView${this.state.key}`).openDevTools();
    });

    ipcRenderer.on('zoom-in', () => {
      const activeTabWebContents = this.getTabWebContents(this.state.key);
      if (!activeTabWebContents) {
        return;
      }
      if (activeTabWebContents.getZoomLevel() >= 9) {
        return;
      }
      activeTabWebContents.setZoomLevel(activeTabWebContents.getZoomLevel() + 1);
    });

    ipcRenderer.on('zoom-out', () => {
      const activeTabWebContents = this.getTabWebContents(this.state.key);
      if (!activeTabWebContents) {
        return;
      }
      if (activeTabWebContents.getZoomLevel() <= -8) {
        return;
      }
      activeTabWebContents.setZoomLevel(activeTabWebContents.getZoomLevel() - 1);
    });

    ipcRenderer.on('zoom-reset', () => {
      const activeTabWebContents = this.getTabWebContents(this.state.key);
      if (!activeTabWebContents) {
        return;
      }
      activeTabWebContents.setZoomLevel(0);
    });

    ipcRenderer.on('undo', () => {
      const activeTabWebContents = this.getTabWebContents(this.state.key);
      if (!activeTabWebContents) {
        return;
      }
      activeTabWebContents.undo();
    });

    ipcRenderer.on('redo', () => {
      const activeTabWebContents = this.getTabWebContents(this.state.key);
      if (!activeTabWebContents) {
        return;
      }
      activeTabWebContents.redo();
    });

    ipcRenderer.on('cut', () => {
      const activeTabWebContents = this.getTabWebContents(this.state.key);
      if (!activeTabWebContents) {
        return;
      }
      activeTabWebContents.cut();
    });

    ipcRenderer.on('copy', () => {
      const activeTabWebContents = this.getTabWebContents(this.state.key);
      if (!activeTabWebContents) {
        return;
      }
      activeTabWebContents.copy();
    });

    ipcRenderer.on('paste', () => {
      const activeTabWebContents = this.getTabWebContents(this.state.key);
      if (!activeTabWebContents) {
        return;
      }
      activeTabWebContents.paste();
    });

    ipcRenderer.on('paste-and-match', () => {
      const activeTabWebContents = this.getTabWebContents(this.state.key);
      if (!activeTabWebContents) {
        return;
      }
      activeTabWebContents.pasteAndMatchStyle();
    });

    //goBack and goForward
    ipcRenderer.on('go-back', () => {
      const mattermost = this.refs[`mattermostView${this.state.key}`];
      if (mattermost.canGoBack()) {
        mattermost.goBack();
      }
    });

    ipcRenderer.on('go-forward', () => {
      const mattermost = this.refs[`mattermostView${this.state.key}`];
      if (mattermost.canGoForward()) {
        mattermost.goForward();
      }
    });

    ipcRenderer.on('add-server', this.addServer);

    ipcRenderer.on('focus-on-webview', this.focusOnWebView);

    ipcRenderer.on('protocol-deeplink', (event, deepLinkUrl) => {
      const parsedDeeplink = this.parseDeeplinkURL(deepLinkUrl);
      if (parsedDeeplink) {
        if (this.state.key !== parsedDeeplink.teamIndex) {
          this.handleSelect(parsedDeeplink.teamIndex);
        }
        this.refs[`mattermostView${parsedDeeplink.teamIndex}`].handleDeepLink(parsedDeeplink.path);
      }
    });

    ipcRenderer.on('toggle-find', () => {
      this.activateFinder(true);
    });
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevState.key !== this.state.key && this.refs[`mattermostView${this.state.key}`]) { // i.e. When tab has been changed
      this.refs[`mattermostView${this.state.key}`].focusOnWebView();
    }
  }

  handleSelect = (key) => {
    const newKey = (this.props.teams.length + key) % this.props.teams.length;
    this.setState({
      key: newKey,
      finderVisible: false,
    });
    const webview = document.getElementById('mattermostView' + newKey);
    ipcRenderer.send('update-title', {
      title: webview.getTitle(),
    });
    window.focus();
    webview.focus();
    this.handleOnTeamFocused(newKey);
  }

  handleBadgeChange = (index, sessionExpired, unreadCount, mentionCount, isUnread, isMentioned) => {
    // NOTE: this method is called in an interval and causes rerender without PureComponent
    const sessionsExpired = this.state.sessionsExpired;
    const unreadCounts = this.state.unreadCounts;
    const mentionCounts = this.state.mentionCounts;
    const unreadAtActive = this.state.unreadAtActive;
    const mentionAtActiveCounts = this.state.mentionAtActiveCounts;
    sessionsExpired[index] = sessionExpired;
    unreadCounts[index] = unreadCount;
    mentionCounts[index] = mentionCount;

    // Never turn on the unreadAtActive flag at current focused tab.
    if (this.state.key !== index || !remote.getCurrentWindow().isFocused()) {
      unreadAtActive[index] = unreadAtActive[index] || isUnread;
      if (isMentioned) {
        mentionAtActiveCounts[index]++;
      }
    }
    this.setState({
      sessionsExpired,
      unreadCounts,
      mentionCounts,
      unreadAtActive,
      mentionAtActiveCounts,
    });
    this.handleBadgesChange();
  }

  markReadAtActive = (index) => {
    const unreadAtActive = this.state.unreadAtActive;
    const mentionAtActiveCounts = this.state.mentionAtActiveCounts;
    unreadAtActive[index] = false;
    mentionAtActiveCounts[index] = 0;
    this.setState({
      unreadAtActive,
      mentionAtActiveCounts,
    });
    this.handleBadgesChange();
  }

  handleBadgesChange = () => {
    if (this.props.onBadgeChange) {
      const someSessionsExpired = this.state.sessionsExpired.some((sessionExpired) => sessionExpired);

      let allUnreadCount = this.state.unreadCounts.reduce((prev, curr) => {
        return prev + curr;
      }, 0);
      this.state.unreadAtActive.forEach((state) => {
        if (state) {
          allUnreadCount += 1;
        }
      });

      let allMentionCount = this.state.mentionCounts.reduce((prev, curr) => {
        return prev + curr;
      }, 0);
      this.state.mentionAtActiveCounts.forEach((count) => {
        allMentionCount += count;
      });

      this.props.onBadgeChange(someSessionsExpired, allUnreadCount, allMentionCount);
    }
  }

  handleOnTeamFocused = (index) => {
    // Turn off the flag to indicate whether unread message of active channel contains at current tab.
    this.markReadAtActive(index);
  }

  handleLogin = (request, username, password) => {
    ipcRenderer.send('login-credentials', request, username, password);
    const loginQueue = this.state.loginQueue;
    loginQueue.shift();
    this.setState({loginQueue});
  }

  handleLoginCancel = () => {
    const loginQueue = this.state.loginQueue;
    loginQueue.shift();
    this.setState({loginQueue});
  }

  handleTargetURLChange = (targetURL) => {
    clearTimeout(this.targetURLDisappearTimeout);
    if (targetURL === '') {
      // set delay to avoid momentary disappearance when hovering over multiple links
      this.targetURLDisappearTimeout = setTimeout(() => {
        this.setState({targetURL: ''});
      }, 500);
    } else {
      this.setState({targetURL});
    }
  }

  addServer = () => {
    this.setState({
      showNewTeamModal: true,
    });
  }

  focusOnWebView = (e) => {
    if (e.target.className !== 'finder-input' && this.refs[`mattermostView${this.state.key}`]) {
      this.refs[`mattermostView${this.state.key}`].focusOnWebView();
    }
  }

  activateFinder = () => {
    this.setState({
      finderVisible: true,
      focusFinder: true,
    });
  }

  closeFinder = () => {
    this.setState({
      finderVisible: false,
    });
  }

  inputBlur = () => {
    this.setState({
      focusFinder: false,
    });
  }

  render() {
    let tabsRow;
    if (this.state.teams.length > 1) {
      tabsRow = (
        <Row>
          <TabBar
            id='tabBar'
            teams={this.state.teams}
            sessionsExpired={this.state.sessionsExpired}
            unreadCounts={this.state.unreadCounts}
            mentionCounts={this.state.mentionCounts}
            unreadAtActive={this.state.unreadAtActive}
            mentionAtActiveCounts={this.state.mentionAtActiveCounts}
            activeKey={this.state.key}
            onSelect={this.handleSelect}
            onAddServer={this.addServer}
            showAddServerButton={this.props.showAddServerButton}
          />
        </Row>
      );
    }

    const views = this.state.teams.map((team, index) => {
      const id = 'mattermostView' + index;
      const isActive = this.state.key === index;

      let teamUrl = team.url;

      if (this.props.deeplinkingUrl) {
        const parsedDeeplink = this.parseDeeplinkURL(this.props.deeplinkingUrl, [team]);
        if (parsedDeeplink) {
          teamUrl = parsedDeeplink.url;
        }
      }

      return (
        <MattermostView
          key={id}
          id={id}
          withTab={this.state.teams.length > 1}
          useSpellChecker={this.props.useSpellChecker}
          onSelectSpellCheckerLocale={this.props.onSelectSpellCheckerLocale}
          src={teamUrl}
          name={team.name}
          onTargetURLChange={this.handleTargetURLChange}
          onBadgeChange={(sessionExpired, unreadCount, mentionCount, isUnread, isMentioned) =>
            this.handleBadgeChange(index, sessionExpired, unreadCount, mentionCount, isUnread, isMentioned)
          }
          onNotificationClick={() => this.handleSelect(index)}
          ref={id}
          active={isActive}
        />);
    });
    const viewsRow = (
      <Row>
        {views}
      </Row>);

    let request = null;
    let authServerURL = null;
    let authInfo = null;
    if (this.state.loginQueue.length !== 0) {
      request = this.state.loginQueue[0].request;
      const tmpURL = url.parse(this.state.loginQueue[0].request.url);
      authServerURL = `${tmpURL.protocol}//${tmpURL.host}`;
      authInfo = this.state.loginQueue[0].authInfo;
    }
    const modal = (
      <NewTeamModal
        show={this.state.showNewTeamModal}
        onClose={() => {
          this.setState({
            showNewTeamModal: false,
          });
        }}
        onSave={(newTeam) => {
          this.setState({
            showNewTeamModal: false,
          });
          this.props.onTeamConfigChange(this.state.teams.concat(newTeam));
        }}
      />
    );
    return (
      <div
        className='MainPage'
        onClick={this.focusOnWebView}
      >
        <SettingsModal
          show={this.state.showSettingsModal}
          config={this.props.config}
        />
        <LoginModal
          show={this.state.loginQueue.length !== 0}
          request={request}
          authInfo={authInfo}
          authServerURL={authServerURL}
          onLogin={this.handleLogin}
          onCancel={this.handleLoginCancel}
        />
        <Grid fluid={true}>
          { tabsRow }
          { viewsRow }
          { this.state.finderVisible ? (
            <Finder
              webviewKey={this.state.key}
              close={this.closeFinder}
              focusState={this.state.focusFinder}
              inputBlur={this.inputBlur}
            />
          ) : null}
        </Grid>
        <TransitionGroup>
          { (this.state.targetURL === '') ?
            null :
            <CSSTransition
              classNames='hovering'
              timeout={{enter: 300, exit: 500}}
            >
              <HoveringURL
                key='hoveringURL'
                targetURL={this.state.targetURL}
              />
            </CSSTransition>
          }
        </TransitionGroup>
        <div>
          { modal }
        </div>
      </div>
    );
  }
}

MainPage.propTypes = {
  onBadgeChange: PropTypes.func.isRequired,
  teams: PropTypes.array.isRequired,
  onTeamConfigChange: PropTypes.func.isRequired,
  initialIndex: PropTypes.number.isRequired,
  useSpellChecker: PropTypes.bool.isRequired,
  onSelectSpellCheckerLocale: PropTypes.func.isRequired,
  deeplinkingUrl: PropTypes.string,
  showAddServerButton: PropTypes.bool.isRequired,
  config: PropTypes.object.isRequired,
};

/* eslint-enable react/no-set-state */
