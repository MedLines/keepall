const form = document.querySelector("#settings");
const input = document.querySelector("#origin");
const status = document.querySelector("#status");
const libraryLink = document.querySelector("#library-link");

chrome.storage.local.get("origin").then(({ origin }) => {
  input.value = origin ?? "https://keepall.app";
  libraryLink.href = `${input.value}/`;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  let origin;
  try {
    const parsed = new URL(input.value);
    origin = parsed.origin;
    if (parsed.href !== `${origin}/` ||
        (origin !== "https://keepall.app" && !/^http:\/\/localhost:\d{2,5}$/.test(origin))) {
      throw new Error("Enter https://keepall.app or a local development address with a port.");
    }
    await chrome.storage.local.set({ origin });
    status.textContent = "Address saved.";
    status.dataset.state = "success";
    libraryLink.href = `${origin}/`;
  } catch (error) {
    status.textContent = error.message;
    status.dataset.state = "error";
  }
});
