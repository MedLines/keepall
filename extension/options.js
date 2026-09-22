const form = document.querySelector("#settings");
const input = document.querySelector("#origin");
const status = document.querySelector("#status");
const libraryLink = document.querySelector("#library-link");
const PRODUCTION_ORIGIN = "https://www.keepall.app";

chrome.storage.local.get("origin").then(({ origin }) => {
  input.value = origin === "https://keepall.app" ? PRODUCTION_ORIGIN : origin ?? PRODUCTION_ORIGIN;
  libraryLink.href = `${input.value}/`;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  let origin;
  try {
    const parsed = new URL(input.value);
    origin = parsed.origin === "https://keepall.app" ? PRODUCTION_ORIGIN : parsed.origin;
    if (parsed.href !== `${parsed.origin}/` ||
        (origin !== PRODUCTION_ORIGIN && !/^http:\/\/localhost:\d{2,5}$/.test(origin))) {
      throw new Error("Enter https://www.keepall.app or a local development address with a port.");
    }
    await chrome.storage.local.set({ origin });
    input.value = origin;
    status.textContent = "Address saved.";
    status.dataset.state = "success";
    libraryLink.href = `${origin}/`;
  } catch (error) {
    status.textContent = error.message;
    status.dataset.state = "error";
  }
});
