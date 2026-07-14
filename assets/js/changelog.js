// Copyright (c) 2024-2026 savas8008 - All Rights Reserved
// Bu dosyanın izinsiz kopyalanması, değiştirilmesi veya dağıtılması yasaktır.

/**
 * @file changelog.js
 * @brief Bağlantı ekranındaki küçük "Son Güncellemeler" panelini
 *        assets/changelog.json'dan doldurur (dikey, yukarı doğru akan liste).
 * @description Elle güncellenen bir JSON dosyası — yeni bir madde eklemek için
 *              changelog.json'a { "date": "...", "items": [...] } ekleyin, HTML'e dokunmayın.
 */

const CHANGELOG_URL = 'assets/changelog.json';

function buildNewsItemsHtml(entries) {
    const rows = [];
    entries.forEach(entry => {
        (entry.items || []).forEach(item => {
            rows.push(
                `<div class="news-panel-item">` +
                    `<span class="news-panel-item-title">${item}</span>` +
                    `<span class="news-panel-item-date">${entry.date}</span>` +
                `</div>`
            );
        });
    });
    return rows;
}

async function loadChangelog() {
    const panel = document.getElementById('newsPanel');
    const track = document.getElementById('newsPanelTrack');
    if (!panel || !track) return;

    try {
        const response = await fetch(CHANGELOG_URL, { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const entries = await response.json();
        const rows = buildNewsItemsHtml(entries);
        if (!rows.length) return;

        // Kusursuz döngü için liste iki kez tekrarlanır (CSS %-50 translateY ile).
        track.innerHTML = rows.join('') + rows.join('');

        panel.style.display = 'block';
    } catch (err) {
        console.warn('[Changelog] Yüklenemedi:', err);
    }
}

document.addEventListener('DOMContentLoaded', loadChangelog);
