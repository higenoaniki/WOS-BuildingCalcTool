function calc() {
  const time = Number(document.getElementById("time").value);
  const speed = Number(document.getElementById("speed").value);

  const result = time / (1 + speed / 100);

  document.getElementById("result").innerText = result + " 秒";
}
