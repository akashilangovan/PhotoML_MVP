const url = require("url");
const path = require("path");
const dotenv = require("dotenv");
const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, "index.html"));

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};
let envPath = path.join(__dirname, ".env");
dotenv.config({ path: envPath });
require("electron-reload")(__dirname);
require("update-electron-app")();
const AWS = require("aws-sdk");
const fs = require("fs");
const fsp = require("fs").promises;
const axios = require("axios");
const { app, BrowserWindow, dialog, ipcMain } = require("electron");
// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
  app.quit();
}
const bucketName = process.env.BUCKET_NAME;
const region = "us-east-2";
const accessKeyId = process.env.aws_accessKeyId;
const secretAccessKey = process.env.aws_secretAccessKey;
const dynamodb = new AWS.DynamoDB.DocumentClient({ region: region });
AWS.config.update({ region: region });
const sns = new AWS.SNS({ apiVersion: "2010-03-31" });
const s3 = new AWS.S3({
  accessKeyId: accessKeyId,
  secretAccessKey: secretAccessKey,
  region: region,
});
let global_dir = "";
const pollJobStatus = async (usernamecollection) => {
  const params = {
    TableName: "jobstatus",
    Key: {
      usernamecollection: usernamecollection.usernamecollection,
    },
  };

  try {
    const data = await dynamodb.get(params).promise();
    console.log(data.Item.status);
    if (data.Item.status === "Completed") {
      console.log("Job Done");
      console.log(data.Item.output);
      return { data: data.Item.output, status: "Completed" };
    } else {
      console.log("Lambda still running...");
      return { data: data.Item.output, status: "inProgress" };
    }
  } catch (error) {
    console.error("Error: ", error);
  }
};
const { exec } = require("child_process");

//Handles image conversion and upload to S3
ipcMain.handle("dir-uploaded", async (event, dir) => {
  const logFilePath = path.join(app.getPath("userData"), "app.log");
  const logStream = fs.createWriteStream(logFilePath, { flags: "a" });
  console.log("in main dir upload");
  console.log(typeof dir.username, dir.collection, dir.dir);
  console.log(dir);
  global_dir = dir.dir;
  let new_dir = dir.dir;
  let new_username = dir.username;
  let new_collectioname = dir.collection;
  console.log(new_dir, new_username, new_collectioname);
  //create a promise for each upload and wait till all are resolved
  return new Promise((resolve, reject) => {
    let resourcePath = path.join(process.resourcesPath, "convertRAW");
    logStream.write(`resourcePath: ${resourcePath} ${new_dir}\n`);
    let localpath = "/Users/akashilangovan/photoml/client/convertRAW";
    console.log("running converter");
    exec(`${localpath} ${new_dir}`, async (err, stdout, stderr) => {
      if (err) {
        console.log(err);
        reject(err);
      }
      console.log("uploading images");
      try {
        let jpegpath = path.join(new_dir, "jpegs");
        const files = await fsp.readdir(jpegpath);
        console.log(files);
        let uploadPromises = [];
        for (const file of files) {
          console.log(file);
          if (file.endsWith(".jpg")) {
            const fileStream = require("fs").createReadStream(
              `${new_dir}/jpegs/${file}`
            );

            const params = {
              Bucket: bucketName,
              Key: `uploads/${new_username}/${new_collectioname}/${file}`,
              Body: fileStream,
            };

            uploadPromises.push(
              new Promise((res, rej) => {
                s3.upload(params, function (err, data) {
                  if (err) {
                    console.log(`Error uploading file ${file}:`, err);
                    rej(err);
                  } else {
                    console.log(
                      `File ${file} processed and uploaded to: ${data.Location}`
                    );
                    event.sender.send(`file-processed-${file}`);
                    res();
                  }
                });
              })
            );
          }
        }
        Promise.all(uploadPromises)
          .then(() => resolve("Done uploading files!"))
          .catch(reject);
      } catch (err) {
        console.error(`Error processing files in directory ${new_dir}:`, err);
        reject(err);
      }
    });
  });
});

//Moves file from sourceDir to appropriate keep/cull folder
function moveFiles(keep, cull, sourceDir) {
  console.log("in move files");
  console.log(keep, cull, sourceDir);
  keep.forEach((kfile) => {
    console.log(kfile);
    const sourcePath = path.join(sourceDir, kfile);
    const targetPath = path.join(sourceDir, "keep");
    if (!fs.existsSync(targetPath)) {
      fs.mkdirSync(targetPath, { recursive: true });
    }
    let finaltargetPath = path.join(targetPath, kfile);
    fs.copyFile(sourcePath, finaltargetPath, (err) => {
      if (err) {
        console.error(`Error moving file ${kfile}:`, err);
      } else {
        console.log(`Successfully moved to keep ${kfile}`);
      }
    });
  });
  cull.forEach((cfile) => {
    console.log(cfile);

    const sourcePath = path.join(sourceDir, cfile);
    const targetPath = path.join(sourceDir, "cull");
    if (!fs.existsSync(targetPath)) {
      fs.mkdirSync(targetPath, { recursive: true });
    }
    let finaltargetPath = path.join(targetPath, cfile);
    // Destination file path
    fs.copyFile(sourcePath, finaltargetPath, (err) => {
      if (err) {
        console.error(`Error moving file ${cfile}:`, err);
      } else {
        console.log(`Successfully moved to cull ${cfile}`);
      }
    });
  });
}
//Onces files are uploaded to S3, this function is called to start the lambda
//sends SNS request to start AWS pipeline
function publishToSns(username, collection_name) {
  let message = {
    username: username,
    collection_name: collection_name,
  };

  let params = {
    Message: JSON.stringify(message),
    TopicArn: "arn:aws:sns:us-east-2:706389910333:CullRequest",
  };
  console.log("final before writing to sns");
  sns.publish(params, function (err, data) {
    if (err) {
      console.error(err, err.stack);
    } else {
      console.log(data);
    }
  });
}
ipcMain.on("sendSNS", (event, items) => {
  console.log("In sendSNS");
  publishToSns(items.username, items.collection_name);
});
ipcMain.on("moveFiles", (event, items) => {
  console.log("in on main for movefiles");
  console.log(items);
  moveFiles(items.keep, items.cull, items.dir);
});

let modal = null; // We'll store our modal here so we can use it later

ipcMain.on("open-modal", () => {
  console.log("modal is: ", modal);

  modal = new BrowserWindow({
    width: 700,
    height: 700,
    modal: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "imgpopup/img_preload.js"),
    },
  });

  modal.on("close", () => {
    modal = null; // On close, clear the modal
  });

  modal.once("ready-to-show", () => {
    console.log("show");
    modal.show();
  });

  modal.loadURL(
    url.format({
      pathname: path.join(__dirname, "imgpopup/popup.html"),
      protocol: "file:",
      slashes: true,
    })
  );
});

ipcMain.handle("pingDB", async (event, usernamecollection) => {
  console.log("in pingDB");
  let output = await pollJobStatus(usernamecollection);
  console.log(output);
  return output;
});
let imageFiles = { keep: [], cull: [] };
let currentImageIndex = { keep: 0, cull: 0 };
//Loads images from filesystem to in memory arrays(just file name)
const loadImages = async (keep, cull) => {
  console.log(keep, cull);
  try {
    const files = await fs.promises.readdir(keep);
    imageFiles["keep"] = files
      .filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return (
          ext === ".png" ||
          ext === ".jpg" ||
          ext === ".jpeg" ||
          ext === ".gif" ||
          ext === ".bmp" ||
          ext === ".NEF" ||
          ext === ".nef"
        );
      })
      .map((file) => {
        return file.slice(0, -4) + ".jpg";
      });

    currentImageIndex["keep"] = 0;
  } catch (err) {
    console.error(`Error reading directory: ${err}`);
  }
  try {
    const files = await fs.promises.readdir(cull);
    imageFiles["cull"] = files
      .filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return (
          ext === ".png" ||
          ext === ".jpg" ||
          ext === ".jpeg" ||
          ext === ".gif" ||
          ext === ".bmp" ||
          ext === ".NEF" ||
          ext === ".nef"
        );
      })
      .map((file) => {
        return file.slice(0, -4) + ".jpg";
      });

    currentImageIndex["cull"] = 0;
  } catch (err) {
    console.error(`Error reading directory: ${err}`);
  }
  // console.log(imageFiles);
  return imageFiles;
};

const moveImage = async (folder, index) => {
  let keepFolder = global_dir + "/keep";
  let cullFolder = global_dir + "/cull";
  const oldFolder = folder === "keep" ? keepFolder : cullFolder;
  const newFolder = folder === "keep" ? cullFolder : keepFolder;

  const fileName = imageFiles[folder][index];
  console.log("filename: " + fileName);
  console.log(fileName.slice(0, -4) + ".NEF");
  const oldPath = path.join(oldFolder, fileName.slice(0, -4) + ".NEF");
  const newPath = path.join(newFolder, fileName.slice(0, -4) + ".NEF");

  try {
    await fs.promises.rename(oldPath, newPath);
  } catch (err) {
    console.error(`Error moving file: ${err}`);
  }
};
ipcMain.on("move-image", (event, items) => {
  moveImage(items.folder, items.index);
});
ipcMain.handle("loadImages", async (event, items) => {
  console.log("in load images");
  console.log("global dir: " + global_dir);

  return await loadImages(global_dir + "/keep/", global_dir + "/cull/");
});
ipcMain.handle("get-dir", async (event) => {
  console.log("in get dir");
  console.log(global_dir);
  return global_dir;
});
app.on("ready", createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
