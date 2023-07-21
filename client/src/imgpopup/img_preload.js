const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("popup", {
  uploadFile: (user, collection, file, id) => {
    ipcRenderer.send("file-uploaded", {
      path: file.path,
      name: file.name,
      collection: collection,
      username: user,
      id: id,
    });
  },
  loadImages: async (folder) => {
    console.log("folder: " + folder);
    return await ipcRenderer.invoke("loadImages", {
      folder: folder,
      //keepfolder
      //cullfolder
    });
  },
  moveImage: (folder, index) => {
    ipcRenderer.send("move-image", {
      folder: folder,
      index: index,
    });
  },
  getDir: async (event) => {
    console.log("in preload getdir");
    return ipcRenderer.invoke("get-dir");
  },
});
