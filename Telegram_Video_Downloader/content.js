(async function() {
    function showToast(text, isError = false) {
        let toast = document.getElementById('tg-downloader-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'tg-downloader-toast';
            toast.style.cssText = `
                position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
                background: ${isError ? '#ff4d4d' : '#282c34'}; color: white;
                padding: 15px 25px; border-radius: 8px; z-index: 999999;
                font-family: sans-serif; font-size: 14px; box-shadow: 0 4px 6px rgba(0,0,0,0.3);
                transition: all 0.3s ease; text-align: center;
            `;
            document.body.appendChild(toast);
        }
        toast.style.background = isError ? '#ff4d4d' : '#282c34';
        toast.innerText = text;
        if (text.includes("Успешно") || isError) {
            setTimeout(() => { if (toast) toast.remove(); }, 4000);
        }
    }

    // Ищем видео
    let video = Array.from(document.querySelectorAll('video')).find(v => !v.paused);
    if (!video) video = document.querySelector('.media-viewer-mover.active video');
    if (!video) {
        let allVideos = document.querySelectorAll('video.ckin__video, video.media-video');
        video = allVideos[allVideos.length - 1]; 
    }
    
    if (!video) return showToast('Видео не найдено! Откройте его на весь экран или нажмите Play.', true);

    const src = video.getAttribute('src');
    if (!src || !src.includes('stream/')) return showToast('Это не зашифрованное видео Telegram', true);

    let fileName = 'video.mp4';
    let totalSize = 0;

    // ШАГ 1: Достаем имя и размер прямо из самой ссылки (самый надежный способ)
    try {
        const jsonStr = decodeURIComponent(src.substring(src.indexOf('stream/') + 7));
        const fileData = JSON.parse(jsonStr);
        fileName = fileData.fileName || fileName;
        totalSize = fileData.size || 0;
    } catch (e) {
        console.log("Не удалось прочитать JSON из ссылки.");
    }

    try {
        showToast("Подготавливаем загрузку...");
        
        // ШАГ 2: Если в ссылке размера не было, делаем запрос к серверу
        if (totalSize === 0) {
            let probeResponse = await fetch(src, { headers: { "Range": "bytes=0-0" } });
            if (probeResponse.status === 206) {
                let cr = probeResponse.headers.get('Content-Range');
                if (cr) totalSize = parseInt(cr.split('/')[1], 10);
            } else if (probeResponse.status === 200) {
                let cl = probeResponse.headers.get('Content-Length');
                if (cl) totalSize = parseInt(cl, 10);
            }
        }

        if (!totalSize || isNaN(totalSize) || totalSize === 0) {
            return showToast('Ошибка: не удалось определить размер файла ни одним способом.', true);
        }

        let downloadedChunks = [];
        let currentByte = 0;

        // ШАГ 3: Скачивание
        while (currentByte < totalSize) {
            let response = await fetch(src, { headers: { "Range": `bytes=${currentByte}-` } });

            // Если сервер решил отдать ВЕСЬ файл сразу (статус 200)
            if (response.status === 200) {
                downloadedChunks.push(await response.arrayBuffer());
                break; // Выходим из цикла, всё скачалось
            }

            if (response.status !== 206) throw new Error(`Ошибка сети: ${response.status}`);

            // Если сервер отдает кусками (статус 206)
            let contentRange = response.headers.get('Content-Range');
            if (!contentRange) throw new Error('Сервер не вернул заголовок Content-Range');

            let match = contentRange.match(/bytes\s+\d+-(\d+)\/\d+/);
            if (!match) throw new Error('Сбой чтения байтов');
            
            let endByte = parseInt(match[1], 10);
            
            downloadedChunks.push(await response.arrayBuffer());
            currentByte = endByte + 1;

            let percent = Math.min(Math.round((currentByte / totalSize) * 100), 100);
            showToast(`Загрузка: ${percent}% ...\n(${(currentByte / 1024 / 1024).toFixed(1)} из ${(totalSize / 1024 / 1024).toFixed(1)} MB)`);
        }

        showToast("Склеиваем видео...");
        
        const blob = new Blob(downloadedChunks, { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            URL.revokeObjectURL(url);
            a.remove();
            showToast("✅ Успешно сохранено!");
        }, 1000);

    } catch (err) {
        showToast("❌ Ошибка: " + err.message, true);
        console.error(err);
    }
})();