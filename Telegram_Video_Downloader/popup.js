document.getElementById('downloadBtn').addEventListener('click', async () => {
    const statusDiv = document.getElementById('status');
    statusDiv.innerText = "Запускаю скрипт...";

    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.url.includes("web.telegram.org")) {
        statusDiv.innerText = "Ошибка: Откройте Telegram Web!";
        return;
    }

    // Выполняем файл content.js прямо в контексте самой страницы (MAIN)
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js'],
        world: "MAIN" // <--- ВОТ ЭТА МАГИЧЕСКАЯ СТРОЧКА ИСПРАВЛЯЕТ ОШИБКУ 302
    }, () => {
        statusDiv.innerText = "Смотрите прогресс на странице Телеграма!";
    });
});