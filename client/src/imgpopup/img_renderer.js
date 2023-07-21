window.addEventListener("click", (event) => {
  if (event.target === document.body) {
    window.close(); // This closes the window if the body is clicked
  }
});
let imageFiles = { keep: [], cull: [] };
let currentImageIndex = { keep: 0, cull: 0 };
let currentFolder = "keep";
const keepFolder = "/Users/akashilangovan/photoml/testing/ugh/keep";
const cullFolder = "/Users/akashilangovan/photoml/testing/ugh/cull";
function changeTab(tabName) {
  let tabContents = document.getElementsByClassName("tab-content");
  for (let i = 0; i < tabContents.length; i++) {
    tabContents[i].classList.remove("active");
  }

  let tab = document.getElementById(tabName);
  tab.classList.add("active");
  currentFolder = tabName;
}
const loadImages = async (folder) => {
  let output = await window.popup.loadImages("ready");
  console.log("in img+render");
  console.log(output);
  imageFiles["keep"] = output["keep"];
  imageFiles["cull"] = output["cull"];
};
const displayImage = (basepath, folder) => {
  console.log("in display image");
  console.log(imageFiles[folder]);
  if (
    currentImageIndex[folder] < 0 ||
    currentImageIndex[folder] >= imageFiles[folder].length
  ) {
    console.error("Invalid image index.");
    return;
  }

  const imagePath =
    basepath + "jpegs/" + imageFiles[folder][currentImageIndex[folder]];
  console.log("image path: " + imagePath);
  const imgElementId = `displayed-image-${folder}`;
  document.getElementById(imgElementId).src = imagePath;
};
document.addEventListener("DOMContentLoaded", async function () {
  await loadImages();
  displayImage("/Users/akashilangovan/photoml/testing/ugh/", "keep");
  displayImage("/Users/akashilangovan/photoml/testing/ugh/", "cull");
  document
    .getElementById("secondimg")
    .addEventListener(
      "click",
      displayImage("/Users/akashilangovan/photoml/testing/ugh/", "keep")
    );
});
async function moveImage() {
  // let basepath = "/Users/akashilangovan/photoml/testing/ugh/";
  let basepath = await window.popup.getDir("event");
  basepath = basepath + "/";
  console.log("in move image");
  console.log(currentFolder);
  window.popup.moveImage(currentFolder, currentImageIndex[currentFolder]);
  await loadImages();
  displayImage(basepath, "keep");
  displayImage(basepath, "cull");
}
document.addEventListener("keydown", (event) => {
  if (event.code === "ArrowRight") changeImage(1, currentFolder);
  else if (event.code === "ArrowLeft") changeImage(-1, currentFolder);
  else if (event.code === "KeyM") moveImage();
});

//move left or right in slideshow of images
async function changeImage(direction, folder) {
  console.log("in change image");
  // let basepath = "/Users/akashilangovan/photoml/testing/ugh/";
  let basepath = await window.popup.getDir("asdasd");
  basepath = basepath + "/";
  currentImageIndex[folder] += direction;
  if (currentImageIndex[folder] < 0) {
    currentImageIndex[folder] = 0;
  }
  if (currentImageIndex[folder] >= imageFiles[folder].length) {
    currentImageIndex[folder] = imageFiles[folder].length - 1;
  }

  displayImage(basepath, folder);
}
