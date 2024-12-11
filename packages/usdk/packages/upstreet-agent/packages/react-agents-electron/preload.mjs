const { contextBridge, ipcRenderer } = require('electron');

// console.log('Preload script is running');

contextBridge.exposeInMainWorld('electron', {
  send: (channel, data) => {
    const validChannels = ['app:quit'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  }
});