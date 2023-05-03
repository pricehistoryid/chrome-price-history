var modal = document.querySelector(".modal");
var modalBtn = document.querySelector(".ph-ext");
var closeBtn = document.getElementsByClassName("close")[0];

modalBtn.onclick = function () {
  modal.style.display = "block";
}

window.onclick = function (event) {
  if (event.target == modal) {
    modal.style.display = "none";
  }
  if (event.target == closeBtn) {
    modal.style.display = "none";
  }
}

window.addEventListener("load", main, false);