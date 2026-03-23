

        function updateLogStats() {
            $('logCount').textContent = `${logStats.total} log`;
            $('statTotalLogs').textContent = logStats.total;
            $('statCommandsSent').textContent = logStats.commands;
            $('statErrors').textContent = logStats.errors;
            $('countSuccess').textContent = logStats.success;
            $('countWarning').textContent = logStats.warning;
            $('countError').textContent = logStats.errors;
            
            const totalBar = (logStats.success + logStats.warning + logStats.errors) || 1;
            $('progressSuccess').style.width = `${(logStats.success / totalBar) * 100}%`;
            $('progressWarning').style.width = `${(logStats.warning / totalBar) * 100}%`;
            $('progressError').style.width = `${(logStats.errors / totalBar) * 100}%`;
        }
        function filterLogs() {
            const filter = $('logLevelFilter').value;
            logContainer.querySelectorAll('.log-entry').forEach(entry => {
                const isVisible = filter === 'all' || entry.classList.contains(`log-${filter}`);
                entry.style.display = isVisible ? 'block' : 'none';
            });
        }
        function searchLogs() {
            currentSearchTerm = $('logSearch').value.trim().toLowerCase();
            if (!currentSearchTerm) { clearSearch(); return; }
            let matchCount = 0;
            logContainer.querySelectorAll('.log-entry').forEach(entry => {
                const text = entry.textContent.toLowerCase();
                if (text.includes(currentSearchTerm)) {
                    entry.classList.add('search-match');
                    entry.style.display = 'block';
                    matchCount++;
                } else {
                    entry.classList.remove('search-match');
                    const logType = Array.from(entry.classList).find(cls => cls.startsWith('log-'))?.replace('log-', '');
                    const currentFilter = $('logLevelFilter').value;
                    entry.style.display = (currentFilter === 'all' || currentFilter === logType) ? 'block' : 'none';
                }
            });
            log(`🔍 Arama: "${currentSearchTerm}" - ${matchCount} eşleşme bulundu`, 'info');
        }
        function clearSearch() {
            $('logSearch').value = '';
            currentSearchTerm = '';
            logContainer.querySelectorAll('.log-entry').forEach(entry => {
                entry.classList.remove('search-match');
            });
            filterLogs();
        }
        function clearLogs() {
            if (logContainer.children.length > 0) {
                logContainer.innerHTML = '';
                log('🗑️ Loglar temizlendi', 'warning');
            }
        }
        function clearAllLogs() {
            if (confirm('Tüm loglar ve istatistikler silinecek. Emin misiniz?')) {
                logContainer.innerHTML = '';
                logStats = { total: 0, commands: 0, errors: 0, success: 0, warning: 0, info: 0, receive: 0 };
                log('🚀 Konsol yeniden başlatıldı...', 'info');
                updateLogStats();
            }
        }
        function exportLogs() {
            const logText = Array.from(logContainer.children).map(el => el.textContent).join('\n');
            const blob = new Blob([logText], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
            a.href = url;
            a.download = `xflight-logs-${timestamp}.txt`;
            a.click();
            URL.revokeObjectURL(url);
            log('📤 Loglar dışa aktarıldı', 'success');
        }
        function toggleAutoScroll() {
            if ($('autoScroll').checked) logContainer.scrollTop = logContainer.scrollHeight;
        }
        function togglePauseLogs() {
            logPaused = $('pauseLogs').checked;
            log(`⏸️ Log kaydı ${logPaused ? 'durduruldu' : 'devam ediyor'}`, 'warning');
        }
		