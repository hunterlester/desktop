// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

const fs = require('fs');

const env = require('../modules/environment');

describe('application', function desc() {
  this.timeout(30000);

  beforeEach(() => {
    env.createTestUserDataDir();
    console.log("set up test user data dir");
    env.cleanTestConfig();
    console.log("set up config");
    this.app = env.getSpectronApp();
    console.log("got spectron");
    const result = this.app.start();
    console.log("started app");
    console.log("result");
    return result;
  });

  afterEach(async () => {
    if (this.app && this.app.isRunning()) {
      await this.app.stop();
    }
  });

  console.log("before test")
  it('should show a window', async () => {
    console.log("staring test for creating window");
    await this.app.client.waitUntilWindowLoaded();
    console.log("window loaded");
    const count = await this.app.client.getWindowCount();
    count.should.equal(1);
    console.log("1 window");
    const opened = await this.app.browserWindow.isDevToolsOpened();
    opened.should.be.false;
    console.log("with dev tools");

    const visible = await this.app.browserWindow.isVisible();
    visible.should.be.true;
    console.log("window is visible!");
  });

  it.skip('should restore window bounds', async () => {
    // bounds seems to be incorrectly calculated in some environments
    // - Windows 10: OK
    // - CircleCI: NG
    const expectedBounds = {x: 100, y: 200, width: 300, height: 400};
    fs.writeFileSync(env.boundsInfoPath, JSON.stringify(expectedBounds));
    await this.app.restart();
    const bounds = await this.app.browserWindow.getBounds();
    bounds.should.deep.equal(expectedBounds);
  });

  it('should NOT restore window bounds if the origin is located on outside of viewarea', async () => {
    // bounds seems to be incorrectly calculated in some environments (e.g. CircleCI)
    // - Windows 10: OK
    // - CircleCI: NG
    fs.writeFileSync(env.boundsInfoPath, JSON.stringify({x: -100000, y: 200, width: 300, height: 400}));
    await this.app.restart();
    let bounds = await this.app.browserWindow.getBounds();
    bounds.x.should.satisfy((x) => (x > -10000));

    fs.writeFileSync(env.boundsInfoPath, JSON.stringify({x: 100, y: 200000, width: 300, height: 400}));
    await this.app.restart();
    bounds = await this.app.browserWindow.getBounds();
    bounds.y.should.satisfy((y) => (y < 10000));
  });

  it('should show settings.html when there is no config file', async () => {
    await this.app.client.waitUntilWindowLoaded();
    await this.app.client.pause(1000);
    const url = await this.app.client.getUrl();
    url.should.match(/\/settings.html$/);

    const existing = await this.app.client.isExisting('#newServerModal');
    existing.should.equal(true);
  });

  it('should show index.html when there is config file', async () => {
    fs.writeFileSync(env.configFilePath, JSON.stringify({
      url: env.mattermostURL,
    }));
    await this.app.restart();

    const url = await this.app.client.getUrl();
    url.should.match(/\/index.html$/);
  });

  it('should upgrade v0 config file', async () => {
    const Config = require('../../src/common/config').default;
    const config = new Config(env.configFilePath);
    fs.writeFileSync(env.configFilePath, JSON.stringify({
      url: env.mattermostURL,
    }));
    await this.app.restart();

    const url = await this.app.client.getUrl();
    url.should.match(/\/index.html$/);

    const str = fs.readFileSync(env.configFilePath, 'utf8');
    const localConfigData = JSON.parse(str);
    localConfigData.version.should.equal(config.defaultData.version);
  });

  it.skip('should be stopped when the app instance already exists', (done) => {
    const secondApp = env.getSpectronApp();

    // In the correct case, 'start().then' is not called.
    // So need to use setTimeout in order to finish this test.
    const timer = setTimeout(() => {
      done();
    }, 3000);
    secondApp.start().then(() => {
      clearTimeout(timer);
      return secondApp.stop();
    }).then(() => {
      done(new Error('Second app instance exists'));
    });
  });
});
