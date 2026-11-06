'use strict';
/**
 * Ενημέρωση της εφαρμογής από το GitHub (releases).
 *  - Ο έλεγχος γίνεται για όλους (Windows, Linux, φορητή έκδοση): ρωτά το GitHub ποια είναι η τελευταία έκδοση.
 *  - Στα Windows με εγκατεστημένη την εφαρμογή (setup.exe) η ενημέρωση κατεβαίνει και εγκαθίσταται με ένα κλικ,
 *    μέσω του electron-updater (χρειάζεται το latest.yml στο release).
 *  - Στη φορητή έκδοση και στο Linux (.deb) δεν γίνεται αυτόματη εγκατάσταση: ανοίγει η σελίδα λήψης.
 *
 * Καταστάσεις που στέλνονται στο παράθυρο (κανάλι 'update'):
 *   { state: 'available', version, notes, canInstall, url }
 *   { state: 'downloading', version, percent }
 *   { state: 'ready', version }
 *   { state: 'none', current }                 (μόνο στον χειροκίνητο έλεγχο)
 *   { state: 'error', error, url, phase }      phase: 'check' | 'download'
 */
const { app, ipcMain, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { compareVersions, fetchLatest } = require('./updateInfo');

class Updater {
  /** opts: { owner, repo, getWin(), beforeInstall() } */
  constructor(opts) {
    this.owner = opts.owner;
    this.repo = opts.repo;
    this.getWin = opts.getWin;
    this.beforeInstall = opts.beforeInstall || (() => {});
    this.latest = null;
    this.state = { state: 'idle' };
    this.au = null;
    this.busy = false;
    this.downloaded = false;
  }

  get releaseUrl() {
    return (this.latest && this.latest.url) || `https://github.com/${this.owner}/${this.repo}/releases/latest`;
  }

  /** Αυτόματη εγκατάσταση: μόνο εγκατεστημένη εφαρμογή στα Windows (όχι φορητή, όχι dev). */
  canInstall() {
    if (process.platform !== 'win32' || !app.isPackaged) return false;
    if (process.env.PORTABLE_EXECUTABLE_FILE || process.env.PORTABLE_EXECUTABLE_DIR) return false;
    return fs.existsSync(path.join(process.resourcesPath, 'app-update.yml'));
  }

  publish(state) {
    state = { current: app.getVersion(), ...state };
    this.state = state;
    const win = this.getWin();
    if (win && !win.isDestroyed()) win.webContents.send('update', state);
    return state;
  }

  /** manual: ο χρήστης ζήτησε έλεγχο (ενημερώνεται και όταν δεν υπάρχει νέα έκδοση ή αποτύχει). */
  async check(manual = false) {
    if (this.busy || this.state.state === 'downloading' || this.state.state === 'ready') return this.state;
    this.busy = true;
    try {
      const rel = await fetchLatest(this.owner, this.repo);
      if (!rel || compareVersions(rel.version, app.getVersion()) <= 0) {
        this.latest = null;
        return manual ? this.publish({ state: 'none', current: app.getVersion() }) : { state: 'none', current: app.getVersion() };
      }
      this.latest = rel;
      return this.publish({ state: 'available', version: rel.version, notes: rel.notes, canInstall: this.canInstall(), url: rel.url });
    } catch (e) {
      const err = { state: 'error', phase: 'check', error: e.message, url: this.releaseUrl };
      return manual ? this.publish(err) : err;
    } finally {
      this.busy = false;
    }
  }

  _autoUpdater() {
    if (this.au) return this.au;
    const { autoUpdater } = require('electron-updater');
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.allowDowngrade = false;
    autoUpdater.setFeedURL({ provider: 'github', owner: this.owner, repo: this.repo });
    autoUpdater.on('download-progress', (p) => {
      this.publish({ state: 'downloading', version: this.latest && this.latest.version, percent: Math.round(p.percent || 0) });
    });
    autoUpdater.on('update-downloaded', () => {
      this.downloaded = true;
      this.publish({ state: 'ready', version: this.latest && this.latest.version });
    });
    this.au = autoUpdater;
    return autoUpdater;
  }

  /** «Ενημέρωση τώρα»: κατεβάζει (αυτόματη εγκατάσταση) ή ανοίγει τη σελίδα λήψης. */
  async download() {
    if (!this.latest) return this.state;
    if (!this.canInstall()) {
      shell.openExternal(this.releaseUrl);
      return this.state;
    }
    if (this.downloaded) return this.publish({ state: 'ready', version: this.latest.version });
    if (this.state.state === 'downloading') return this.state;
    this.publish({ state: 'downloading', version: this.latest.version, percent: 0 });
    try {
      const au = this._autoUpdater();
      await au.checkForUpdates();
      await au.downloadUpdate();
    } catch (e) {
      return this.publish({ state: 'error', phase: 'download', error: e.message, url: this.releaseUrl });
    }
    return this.state;
  }

  /** «Επανεκκίνηση και εγκατάσταση»: κλείνει την εφαρμογή, εγκαθιστά σιωπηλά και την ξεκινά ξανά. */
  install() {
    if (!this.downloaded || !this.au) return;
    this.beforeInstall();
    setImmediate(() => this.au.quitAndInstall(true, true));
  }

  register() {
    ipcMain.handle('update:check', (_e, manual) => this.check(!!manual));
    ipcMain.handle('update:download', () => this.download());
    ipcMain.handle('update:install', () => this.install());
    ipcMain.handle('update:state', () => this.state);
  }
}

module.exports = { Updater };
