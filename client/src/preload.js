const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  uploadFile: (user, collection, file, id) => {
    ipcRenderer.send("file-uploaded", {
      path: file.path,
      name: file.name,
      collection: collection,
      username: user,
      id: id,
    });
  },

  openModal: () => {
    console.log("in preload openmodal");
    ipcRenderer.send("open-modal");
  },

  onFileProcessed: (id, callback) => {
    ipcRenderer.on(`file-processed-${id}`, (event, data) => {
      callback(data);
      ipcRenderer.removeAllListeners(`file-processed-${id}`);
    });
  },

  signup: (email, password) => {
    ipcRenderer.send("signup", {
      username: email,
      password: password,
    });
  },

  moveFiles: (keep, cull, dir) => {
    console.log(keep, cull, dir);
    console.log("in preload movefiles");

    ipcRenderer.send("moveFiles", {
      keep: keep,
      cull: cull,
      dir: dir,
    });
  },
  pingDB: async (usernamecollection) => {
    console.log("Key: " + usernamecollection);
    return await ipcRenderer.invoke("pingDB", {
      usernamecollection: usernamecollection,
    });
  },
  sendSNS: (username, collection_name) => {
    console.log(username, collection_name);
    ipcRenderer.send("sendSNS", {
      username: username,
      collection_name: collection_name,
    });
  },
  dirUpload: async (dir, username, collection) => {
    console.log("in preload dir upload");
    console.log(dir, username, collection);
    return await ipcRenderer.invoke("dir-uploaded", {
      dir: dir,
      username: username,
      collection: collection,
    });
  },
});
