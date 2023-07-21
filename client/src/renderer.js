function getDirectory(filePath) {
  return filePath.substring(0, filePath.lastIndexOf("/"));
}
// let limit = 1;
// window.onload = function () {
//   // Get the slider
//   let slider = document.getElementById("intensityRange");

//   // Print the value on input
//   slider.oninput = function () {
//     limit = this.value;
//   };
// };
document.getElementById("runbtn").addEventListener("click", async (e) => {
  let loading = document.getElementById("loading");
  loading.innerHTML = "Converting images...";
  document.getElementById("spinner").style.display = "flex";

  let user = document.getElementById("user").value;
  let collection = document.getElementById("collection").value;
  // let intensity = document.getElementById("intensityRange").value;
  console.log("User is " + user);
  console.log("Collection is " + collection);
  let dir = getDirectory(document.getElementById("dir").files[0].path);
  console.log(dir, user, collection);
  let output = await window.electron.dirUpload(dir, user, collection);
  loading.innerHTML = "Uploading to S3...";
  console.log("after await");
  console.log("output is" + output);
  // let slider = document.getElementById("intensityRange");
  // console.log(slider.value);
  // console.log(typeof slider.value);
  // const limit = parseInt(slider.value);
  // console.log(limit);
  // let tasks = [];
  // let currentId = 0;
  // console.time("Images");
  // for (let i = 1; i < document.getElementById("dir").files.length; i++) {
  //   console.log(`Processing file #${i}`);
  //   let id = currentId++;
  //   tasks.push(
  //     new Promise((resolve, reject) => {
  //       window.electron.uploadFile(
  //         user,
  //         collection,
  //         document.getElementById("dir").files[i],
  //         id
  //       );
  //       window.electron.onFileProcessed(id, (data) => {
  //         console.log(`File #${i} processed: `, data);
  //         resolve();
  //       });
  //     })
  //   );

  //   if (
  //     tasks.length === limit ||
  //     i === document.getElementById("dir").files.length - 1
  //   ) {
  //     console.log("Awaiting tasks completion...");
  //     await Promise.all(tasks);
  //     console.log("Tasks completed");
  //     tasks = [];
  //   }
  // }
  // console.log("done");
  // console.timeEnd("Images");

  console.log("Writing to SNS...");
  window.electron.sendSNS(user, collection);

  while (true) {
    let ping = await window.electron.pingDB(user + collection);
    loading.innerHTML = "Waiting for ML model...";
    console.log("pinging");
    console.log(ping);
    try {
      if (ping.status === "Completed") {
        console.log("Success:", ping.data);
        let str = ping.data;
        console.log(str);
        let dirs = JSON.parse(str.replace(/'/g, '"'));
        window.electron.moveFiles(dirs[0], dirs[2], dir);
        document.getElementById("spinner").style.display = "none";

        break;
      } else {
        console.log("Still waiting for lambda...");
      }
    } catch (error) {
      console.error("Probably job start lambda has not done firing yet...");
    }

    await new Promise((r) => setTimeout(r, 10000));
  }
  let donebtn = document.getElementById("done");
  window.electron.openModal();
  donebtn.style.display = "block";
  dir = "";
  user.value = "";
  collection.value = "";
});

document.getElementById("done").addEventListener("click", async (e) => {
  console.log("in done");
  window.electron.openModal();
});
document.addEventListener("DOMContentLoaded", async function () {
  document
    .getElementById("file-upload-button")
    .addEventListener("click", function () {
      document.getElementById("dir").click();
    });
});
