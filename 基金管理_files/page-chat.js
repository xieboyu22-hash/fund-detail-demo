/* global echarts */

class ChatApp {
    constructor() {
        this.currentChatId = null;
        this.chatHistory = [];
        this.isTyping = false;
        this.isDarkTheme = false;
        this.userId = 'anonymous';
        this.historyDrawerOpen = false;
        this.models = [];
        this.currentModel = null;

        this.elements = {
            newChatBtn: document.getElementById('newChatBtn'),
            historyDrawerBtn: document.getElementById('historyDrawerBtn'),
            historyDrawer: document.getElementById('historyDrawer'),
            historyDrawerOverlay: document.getElementById('historyDrawerOverlay'),
            historyDrawerClose: document.getElementById('historyDrawerClose'),
            historyList: document.getElementById('historyList'),
            messagesContainer: document.getElementById('messagesContainer'),
            messageInput: document.getElementById('messageInput'),
            sendBtn: document.getElementById('sendBtn'),
            modelSelect: document.getElementById('modelSelect'),
            charCount: document.getElementById('charCount'),
            loadingIndicator: document.getElementById('loadingIndicator'),
            chatTitle: document.getElementById('chatTitle'),
            clearChatBtn: document.getElementById('clearChatBtn'),
            modalOverlay: document.getElementById('modalOverlay'),
            modalTitle: document.getElementById('modalTitle'),
            modalMessage: document.getElementById('modalMessage'),
            modalConfirm: document.getElementById('modalConfirm'),
            modalCancel: document.getElementById('modalCancel'),
            modalClose: document.getElementById('modalClose')
        };
        
        this.initMarkdown();
        this.init();
    }
    
    initMarkdown() {
        if (typeof marked === 'undefined') {
            console.warn('marked.js 未加载，Markdown 渲染不可用');
            return;
        }
        
        const renderer = new marked.Renderer();
        renderer.link = ({ href, title, tokens }) => {
            let text = '';
            if (tokens) {
                for (const token of tokens) {
                    text += token.text || token.raw || '';
                }
            }
            if (!text) {
                text = title || href;
            }
            return `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
        };
        
        marked.setOptions({
            renderer: renderer,
            breaks: true,
            gfm: true,
            headerIds: false,
            mangle: false
        });
    }
    
    async init() {
        await this.loadFromStorage();
        this.bindEvents();
        await this.loadModels();
        this.updateUI();
        this.autoResizeTextarea();
        this.createNewChat();
    }
    
    bindEvents() {
        this.elements.newChatBtn.addEventListener('click', () => {
            this.createNewChat();
        });

        this.elements.modelSelect.addEventListener('change', (e) => {
            this.currentModel = e.target.value;
            localStorage.setItem('chat.currentModel', this.currentModel);
        });

        this.elements.historyDrawerBtn.addEventListener('click', () => {
            this.openHistoryDrawer();
        });

        this.elements.historyDrawerClose.addEventListener('click', () => {
            this.closeHistoryDrawer();
        });

        this.elements.historyDrawerOverlay.addEventListener('click', () => {
            this.closeHistoryDrawer();
        });

        this.elements.sendBtn.addEventListener('click', () => {
            this.sendMessage();
        });

        this.elements.messageInput.addEventListener('input', () => {
            this.updateCharCount();
            this.autoResizeTextarea();
            this.updateSendButton();
        });

        this.elements.clearChatBtn.addEventListener('click', () => {
            this.showModal('清空对话', '确定要清空当前对话吗？此操作不可撤销。', () => {
                this.clearCurrentChat();
            });
        });

        this.elements.modalClose.addEventListener('click', () => {
            this.hideModal();
        });

        this.elements.modalCancel.addEventListener('click', () => {
            this.hideModal();
        });

        this.elements.modalOverlay.addEventListener('click', (e) => {
            if (e.target === this.elements.modalOverlay) {
                this.hideModal();
            }
        });

        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                this.createNewChat();
            }

            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                this.toggleHistoryDrawer();
            }

            if (e.key === 'Escape') {
                if (this.historyDrawerOpen) {
                    this.closeHistoryDrawer();
                    return;
                }
                this.hideModal();
            }
        });

        window.addEventListener('resize', () => {
            this.handleResize();
            this.resizeEcharts();
        });
    }
    
    async loadFromStorage() {
        try {
            const stored = localStorage.getItem('chatAppSettings');
            if (stored) {
                const data = JSON.parse(stored);
                this.isDarkTheme = data.isDarkTheme || false;
            }

            // 以 admin 全局主题为默认值
            if (window.App && App.state && App.state.theme) {
                this.isDarkTheme = App.state.theme === 'dark';
            }

            this.currentModel = localStorage.getItem('chat.currentModel') || null;

            await this.loadHistoryFromAPI();
        } catch (error) {
            console.error('加载数据失败:', error);
            this.chatHistory = [];
            this.currentChatId = null;
        }
    }

    async loadModels() {
        try {
            const response = await fetch(`${App.config.API_BASE}/chat/models`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            this.models = result.data || [];
            this.renderModelSelect();
        } catch (error) {
            console.error('加载模型列表失败:', error);
            this.models = [];
        }
    }

    renderModelSelect() {
        const select = this.elements.modelSelect;
        select.innerHTML = '';

        if (!this.models.length) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = '暂无可用模型';
            select.appendChild(option);
            this.currentModel = null;
            return;
        }

        const defaultModel = this.models.find(m => m.defaultSelected);
        if (!this.currentModel || !this.models.some(m => m.name === this.currentModel)) {
            this.currentModel = defaultModel ? defaultModel.name : this.models[0].name;
            localStorage.setItem('chat.currentModel', this.currentModel);
        }

        this.models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.name;
            option.textContent = `${model.label} (${model.model})`;
            option.selected = model.name === this.currentModel;
            select.appendChild(option);
        });
    }
    
    async loadHistoryFromAPI() {
        try {
            const response = await fetch(`${App.config.API_BASE}/chat/history?userId=${this.userId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            const historyData = result.data || [];
            
            // 保留已有会话的本地 messages，避免刷新历史列表时清空当前对话内容
            const existingMessagesMap = new Map();
            this.chatHistory.forEach(chat => {
                existingMessagesMap.set(chat.id, chat.messages);
            });
            
            this.chatHistory = historyData.map(item => ({
                id: item.sessionId,
                title: item.title || '新对话',
                messages: existingMessagesMap.get(item.sessionId) || [],
                createdAt: new Date(item.updateTime).getTime(),
                updatedAt: new Date(item.updateTime).getTime()
            }));
        } catch (error) {
            console.error('加载历史对话失败:', error);
            this.chatHistory = [];
            this.currentChatId = null;
        }
    }
    
    saveToStorage() {
        try {
            const data = {
                isDarkTheme: this.isDarkTheme
            };
            localStorage.setItem('chatAppSettings', JSON.stringify(data));
        } catch (error) {
            console.error('保存UI设置失败:', error);
        }
    }
    
    createNewChat() {
        const chatId = this.generateUUID();
        const newChat = {
            id: chatId,
            title: '新对话',
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        this.chatHistory.unshift(newChat);
        this.currentChatId = chatId;
        this.closeHistoryDrawer();
        this.updateUI();
        this.saveToStorage();
        this.elements.messageInput.focus();
    }
    
    async sendMessage() {
        const text = this.elements.messageInput.value.trim();
        if (!text || this.isTyping) return;
        
        const currentChat = this.getCurrentChat();
        if (!currentChat) return;
        
        const userMessage = {
            id: this.generateId(),
            role: 'user',
            content: text,
            timestamp: Date.now()
        };
        
        currentChat.messages.push(userMessage);
        this.addMessageToUI(userMessage);
        
        this.elements.messageInput.value = '';
        this.updateCharCount();
        this.autoResizeTextarea();
        this.updateSendButton();
        
        if (currentChat.messages.length === 1) {
            currentChat.title = text.length > 20 ? text.substring(0, 20) + '...' : text;
        }
        
        currentChat.updatedAt = Date.now();
        this.updateUI();
        this.saveToStorage();
        
        this.showLoading();
        this.isTyping = true;
        this.updateSendButton();
        
        // 先预创建 trace，拿到 traceId 后再启动流式对话与思考过程轮询
        let traceId;
        try {
            traceId = await this.prepareTrace(currentChat.id, text);
        } catch (error) {
            console.error('预创建 trace 失败:', error);
            this.hideLoading();
            this.isTyping = false;
            this.updateSendButton();
            
            const errorMessage = {
                id: this.generateId(),
                role: 'assistant',
                content: '抱歉，服务初始化失败，请稍后再试。',
                timestamp: Date.now()
            };
            currentChat.messages.push(errorMessage);
            this.addMessageToUI(errorMessage);
            this.saveToStorage();
            return;
        }
        
        await this.callStreamAPI(currentChat, text, traceId);
    }
    
    async prepareTrace(sessionId, message) {
        const response = await fetch(`${App.config.API_BASE}/chat/prepare`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sessionId: sessionId,
                message: message
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        if (result.data) {
            return result.data;
        }
        throw new Error('prepare response has no traceId');
    }
    
    async callStreamAPI(chat, userText, traceId) {
        let thinkingElement = null;
        let pollInterval = null;
        let lastTrace = null;

        try {
            this.hideLoading();

            // 在用户消息与 AI 消息之间插入实时思考过程卡片，并立即开始轮询
            thinkingElement = this.addThinkingToUI(traceId);
            pollInterval = setInterval(async () => {
                if (!thinkingElement || !thinkingElement.isConnected) {
                    clearInterval(pollInterval);
                    return;
                }
                try {
                    lastTrace = await this.loadTrace(traceId);
                    this.renderThinking(thinkingElement, lastTrace);
                } catch (e) {
                    console.warn('轮询思考过程失败:', e);
                }
            }, 300);
            this.loadTrace(traceId).then(trace => {
                lastTrace = trace;
                this.renderThinking(thinkingElement, trace);
            }).catch(() => {});

            const response = await fetch(`${App.config.API_BASE}/chat/stream`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'text/event-stream'
                },
                body: JSON.stringify({
                    sessionId: chat.id,
                    message: userText,
                    traceId: traceId,
                    llmModel: this.currentModel
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const assistantMessage = {
                id: this.generateId(),
                role: 'assistant',
                content: '',
                traceId: traceId,
                traceExpanded: false,
                skipTraceButton: true,
                timestamp: Date.now()
            };

            chat.messages.push(assistantMessage);
            const messageElement = this.addMessageToUI(assistantMessage);
            const textElement = messageElement.querySelector('.message-text');

            this.showTypingIndicator(textElement);

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullContent = '';
            let buffer = '';
            let isFirstChunk = true;
            let chartState = { started: false, startIndex: -1 };

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                // 按 SSE 事件分隔符 \n\n 分割，确保多行 data 被正确拼接
                let eventEndIndex;
                while ((eventEndIndex = buffer.indexOf('\n\n')) !== -1) {
                    const event = buffer.substring(0, eventEndIndex);
                    buffer = buffer.substring(eventEndIndex + 2);

                    const eventLines = event.split('\n');
                    let dataContent = '';
                    for (const eventLine of eventLines) {
                        if (eventLine.startsWith('data:')) {
                            const dataLine = eventLine.substring(5).trim();
                            dataContent += (dataContent ? '\n' : '') + dataLine;
                        }
                    }

                    if (dataContent) {
                        if (isFirstChunk) {
                            this.hideTypingIndicator(textElement);
                            isFirstChunk = false;
                        }
                        fullContent += dataContent;
                        assistantMessage.content = fullContent;

                        // 一旦检测到图表输出标记，后续内容用 loading 占位替代，避免用户看到原始 JSON
                        if (!chartState.started) {
                            const echartsIdx = fullContent.indexOf('echarts');
                            const codeBlockIdx = fullContent.indexOf('```echarts');
                            if (echartsIdx !== -1 || codeBlockIdx !== -1) {
                                chartState.started = true;
                                chartState.startIndex = echartsIdx !== -1 ? echartsIdx : codeBlockIdx;
                            }
                        }

                        if (chartState.started) {
                            const prefix = fullContent.substring(0, chartState.startIndex);
                            textElement.innerHTML = this.formatMessageContent(prefix) +
                                '<div class="echarts-loading"><i class="fas fa-spinner fa-spin"></i><span>图表绘制中...</span></div>';
                        } else {
                            textElement.innerHTML = this.formatMessageContent(fullContent);
                        }
                        textElement.classList.add('typing-cursor');
                        this.scrollToBottom();
                    }
                }

                await this.delay(10);
            }

            // 处理流末尾可能未以 \n\n 结尾的剩余数据
            if (buffer.trim()) {
                const eventLines = buffer.split('\n');
                let dataContent = '';
                for (const eventLine of eventLines) {
                    if (eventLine.startsWith('data:')) {
                        const dataLine = eventLine.substring(5).trim();
                        dataContent += (dataContent ? '\n' : '') + dataLine;
                    }
                }
                if (dataContent) {
                    fullContent += dataContent;
                    assistantMessage.content = fullContent;
                    if (!chartState.started) {
                        const echartsIdx = fullContent.indexOf('echarts');
                        const codeBlockIdx = fullContent.indexOf('```echarts');
                        if (echartsIdx !== -1 || codeBlockIdx !== -1) {
                            chartState.started = true;
                            chartState.startIndex = echartsIdx !== -1 ? echartsIdx : codeBlockIdx;
                        }
                    }
                }
            }

            textElement.classList.remove('typing-cursor');
            // 流式结束后先尝试直接从原始内容提取并渲染 ECharts，避免依赖 marked 解析代码块
            const renderedFromContent = this.renderEchartsFromContent(assistantMessage.content, textElement);
            if (!renderedFromContent) {
                // 兜底：走正常的 Markdown 渲染 + ECharts 检测
                textElement.innerHTML = this.formatMessageContent(assistantMessage.content);
                this.renderEcharts(textElement);
            }

            // 流式输出结束后停止轮询，并拉取最终 trace 状态渲染
            if (pollInterval) {
                clearInterval(pollInterval);
                pollInterval = null;
            }
            if (thinkingElement) {
                try {
                    lastTrace = await this.loadTrace(traceId);
                    this.renderThinking(thinkingElement, lastTrace);
                    this.addThinkingTraceButton(thinkingElement, traceId);
                } catch (e) {
                    console.warn('加载最终思考过程失败:', e);
                }
            }

            chat.updatedAt = Date.now();
            this.isTyping = false;
            this.updateSendButton();
            this.saveToStorage();
            await this.loadHistoryFromAPI();
            this.updateChatHistory();
        } catch (error) {
            if (pollInterval) {
                clearInterval(pollInterval);
            }
            console.error('调用流式API失败:', error);
            this.hideLoading();
            this.isTyping = false;
            this.updateSendButton();

            const errorMessage = {
                id: this.generateId(),
                role: 'assistant',
                content: '抱歉，服务暂时不可用，请稍后再试。',
                timestamp: Date.now()
            };

            chat.messages.push(errorMessage);
            this.addMessageToUI(errorMessage);
            this.saveToStorage();
        }
    }
    
    async typewriterEffect(element, text) {
        element.innerHTML = '';
        element.classList.add('typing-cursor');
        
        let currentText = '';
        const words = text.split('');
        
        for (let i = 0; i < words.length; i++) {
            currentText += words[i];
            element.innerHTML = this.formatMessageContent(currentText);
            
            let delay = 30;
            if (words[i] === '\n') delay = 100;
            else if (words[i] === '。' || words[i] === '！' || words[i] === '？') delay = 200;
            else if (words[i] === '，' || words[i] === '；') delay = 100;
            else if (/[a-zA-Z]/.test(words[i])) delay = 20;
            
            await this.delay(delay);
            this.scrollToBottom();
        }
        
        element.classList.remove('typing-cursor');
    }
    
    addMessageToUI(message) {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${message.role}-message`;
        messageElement.setAttribute('data-timestamp', message.timestamp);
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.innerHTML = message.role === 'user' ? 
            '<i class="fas fa-user"></i>' : 
            '<i class="fas fa-robot"></i>';
        
        const content = document.createElement('div');
        content.className = 'message-content';
        
        const text = document.createElement('div');
        text.className = 'message-text';
        text.innerHTML = this.formatMessageContent(message.content);
        
        // 如果消息中包含 ```echarts 代码块，渲染为 ECharts 图表
        this.renderEcharts(text);
        
        content.appendChild(text);
        
        if (message.role === 'assistant' && message.traceId && !message.skipTraceButton) {
            const traceToggle = document.createElement('button');
            traceToggle.className = 'trace-toggle-btn';
            traceToggle.innerHTML = '<i class="fas fa-brain"></i> 查看思考过程';
            traceToggle.onclick = () => this.toggleTrace(message, traceToggle, content);
            content.appendChild(traceToggle);
        }
        
        const time = document.createElement('div');
        time.className = 'message-time';
        time.textContent = this.formatTime(message.timestamp);
        
        content.appendChild(time);
        messageElement.appendChild(avatar);
        messageElement.appendChild(content);
        
        this.elements.messagesContainer.appendChild(messageElement);
        this.scrollToBottom();
        
        return messageElement;
    }
    
    /**
     * 直接从原始文本内容中提取 ECharts JSON 并渲染。
     * 不依赖 marked 是否正确解析代码块，作为流式输出结束后的主要渲染路径。
     */
    renderEchartsFromContent(content, container) {
        if (typeof echarts === 'undefined' || !content || typeof content !== 'string') {
            return false;
        }

        const processedContent = this.preprocessEchartsContent(content);
        const start = processedContent.indexOf('```echarts');
        if (start === -1) return false;

        const jsonStart = processedContent.indexOf('\n', start) + 1;
        const end = processedContent.indexOf('\n```', jsonStart);
        if (end === -1 || end <= jsonStart) return false;

        const jsonText = processedContent.substring(jsonStart, end).trim();
        try {
            const option = JSON.parse(jsonText);
            if (!this.isEchartsOption(option)) return false;

            const prefix = processedContent.substring(0, start);
            const suffix = processedContent.substring(end + 4);

            let html = '';
            if (prefix.trim()) html += this.formatMessageContent(prefix);
            if (suffix.trim()) html += this.formatMessageContent(suffix);
            container.innerHTML = html;

            const chartDiv = document.createElement('div');
            chartDiv.className = 'echarts-chart';
            chartDiv.style.width = '900px';
            chartDiv.style.minWidth = '900px';
            chartDiv.style.height = '520px';
            chartDiv.style.marginTop = '12px';
            chartDiv.style.marginBottom = '12px';
            container.appendChild(chartDiv);

            container.classList.add('has-echarts');
            container.style.maxWidth = '100%';
            container.style.overflowX = 'auto';

            const chart = echarts.init(chartDiv);
            chart.setOption(option);
            if (!this.echartsInstances) {
                this.echartsInstances = [];
            }
            this.echartsInstances.push(chart);
            return true;
        } catch (e) {
            console.error('从内容提取 ECharts 失败:', e);
            return false;
        }
    }

    renderEcharts(container) {
        if (typeof echarts === 'undefined') {
            console.warn('ECharts 未加载，无法渲染图表');
            return;
        }

        if (!this.echartsInstances) {
            this.echartsInstances = [];
        }

        const codeBlocks = container.querySelectorAll('pre code.language-echarts, pre code.language-json, pre code');
        codeBlocks.forEach(code => {
            this.tryRenderEchartsFromText(code.parentElement, code.textContent);
        });

        // 兼容 AI 未输出代码块、直接粘贴 JSON 文本或把 echarts 前缀粘在 JSON 前面的情况
        container.querySelectorAll('p, div, span').forEach(el => {
            const text = el.textContent.trim();
            if (text.startsWith('echarts') || text.includes('echarts {"')) {
                this.tryRenderEchartsFromText(el, text);
                return;
            }
            if (text.startsWith('{') && text.includes('"series"') &&
                (text.includes('"title"') || text.includes('"legend"') || text.includes('"tooltip"') || text.includes('"xAxis"') || text.includes('"yAxis"'))) {
                this.tryRenderEchartsFromText(el, text);
            }
        });
    }

    tryRenderEchartsFromText(element, text) {
        try {
            let jsonText = (text || '').trim();
            if (!jsonText) return;

            // 兼容 echarts 前缀、说明文字等
            const start = jsonText.indexOf('{');
            const end = jsonText.lastIndexOf('}');
            if (start === -1 || end === -1 || end <= start) return;
            jsonText = jsonText.substring(start, end + 1);

            const option = JSON.parse(jsonText);
            if (!this.isEchartsOption(option)) return;

            const chartDiv = document.createElement('div');
            chartDiv.className = 'echarts-chart';
            chartDiv.style.width = '900px';
            chartDiv.style.minWidth = '900px';
            chartDiv.style.height = '520px';
            chartDiv.style.marginTop = '12px';
            chartDiv.style.marginBottom = '12px';

            const parent = element.parentElement;
            if (parent) {
                parent.replaceChild(chartDiv, element);
                parent.classList.add('has-echarts');
                parent.style.maxWidth = '100%';
                parent.style.overflowX = 'auto';
            }

            const chart = echarts.init(chartDiv);
            chart.setOption(option);
            this.echartsInstances.push(chart);
        } catch (e) {
            console.error('ECharts 渲染失败:', e);
        }
    }

    isEchartsOption(obj) {
        if (!obj || typeof obj !== 'object') return false;
        // ECharts option 通常包含 series，且 series 为数组
        if (!Array.isArray(obj.series)) return false;
        // 同时至少包含 title、xAxis、yAxis、legend、tooltip 中的一个
        return !!(obj.title || obj.xAxis || obj.yAxis || obj.legend || obj.tooltip);
    }

    resizeEcharts() {
        if (this.echartsInstances) {
            this.echartsInstances.forEach(chart => {
                if (chart && typeof chart.resize === 'function') {
                    chart.resize();
                }
            });
        }
    }

    preprocessEchartsContent(content) {
        if (!content || typeof content !== 'string') return content;
        if (content.includes('```echarts') || !content.includes('echarts')) {
            return content;
        }

        const echartsIdx = content.indexOf('echarts');
        const braceStart = content.indexOf('{', echartsIdx);
        if (braceStart === -1) return content;

        const lastBrace = content.lastIndexOf('}');
        if (lastBrace === -1 || lastBrace <= braceStart) return content;

        const jsonText = content.substring(braceStart, lastBrace + 1);
        if (!jsonText.includes('"series"')) return content;

        const prefix = content.substring(0, echartsIdx);
        const suffix = content.substring(lastBrace + 1);
        return prefix + '\n```echarts\n' + jsonText + '\n```\n' + suffix;
    }

    formatMessageContent(content) {
        if (!content) return '';

        // 先把 AI 可能直接输出的 echarts 前缀 JSON 包成代码块，再交给 marked 解析
        content = this.preprocessEchartsContent(content);

        if (typeof marked === 'undefined' || typeof DOMPurify === 'undefined') {
            console.warn('Markdown 渲染库未加载，marked=', typeof marked, 'DOMPurify=', typeof DOMPurify);
            return this.escapeHtml(content).replace(/\n/g, '<br>');
        }

        try {
            const rawHtml = marked.parse(content);
            const sanitized = DOMPurify.sanitize(rawHtml, {
                ALLOWED_TAGS: [
                    'p', 'br', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                    'strong', 'b', 'em', 'i', 'u', 'strike', 'del', 'a', 'img',
                    'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'hr',
                    'table', 'thead', 'tbody', 'tr', 'th', 'td'
                ],
                ALLOWED_ATTR: ['href', 'title', 'alt', 'src', 'target', 'rel', 'class'],
                ALLOW_DATA_ATTR: false
            });
            return sanitized;
        } catch (error) {
            console.error('Markdown 渲染失败:', error);
            return this.escapeHtml(content).replace(/\n/g, '<br>');
        }
    }

    async toggleTrace(message, button, contentContainer) {
        message.traceExpanded = !message.traceExpanded;
        const existingPanel = contentContainer.querySelector('.trace-panel');

        if (existingPanel) {
            existingPanel.remove();
            button.innerHTML = '<i class="fas fa-brain"></i> 查看思考过程';
            return;
        }

        button.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> 加载思考过程...';

        if (!message.traceData) {
            message.traceData = await this.loadTrace(message.traceId);
        }

        button.innerHTML = '<i class="fas fa-brain"></i> 隐藏思考过程';
        const panel = this.renderTracePanel(message.traceData);
        contentContainer.insertBefore(panel, button.nextSibling);
    }

    async loadTrace(traceId) {
        try {
            const response = await fetch(`${App.config.API_BASE}/chat/trace/${traceId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            return result.data;
        } catch (error) {
            console.error('加载思考过程失败:', error);
            return null;
        }
    }

    renderTracePanel(trace) {
        const panel = document.createElement('div');
        panel.className = 'trace-panel';

        if (!trace || !trace.spans || trace.spans.length === 0) {
            panel.innerHTML = '<div class="trace-empty">暂无思考过程数据</div>';
            return panel;
        }

        const header = document.createElement('div');
        header.className = 'trace-header';
        header.innerHTML = `
            <span><i class="fas fa-route"></i> 思考过程</span>
            <span class="trace-status trace-status-${(trace.status || 'success').toLowerCase()}">${trace.status || 'success'}</span>
        `;
        panel.appendChild(header);

        const timeline = document.createElement('div');
        timeline.className = 'trace-timeline';

        trace.spans.forEach(span => {
            const item = document.createElement('div');
            item.className = `trace-item trace-status-${(span.status || 'success').toLowerCase()}`;

            const title = document.createElement('div');
            title.className = 'trace-item-title';
            title.innerHTML = `<span class="trace-dot"></span><span class="trace-title-text">${this.escapeHtml(span.title || span.spanType)}</span><span class="trace-item-meta">${span.costMillis || 0}ms</span>`;

            item.appendChild(title);

            if (span.inputPayload) {
                const inputBlock = document.createElement('div');
                inputBlock.className = 'trace-payload';
                inputBlock.innerHTML = '<div class="trace-payload-label">输入</div><pre>' + this.escapeHtml(this.formatJson(span.inputPayload)) + '</pre>';
                item.appendChild(inputBlock);
            }

            if (span.outputPayload) {
                const outputBlock = document.createElement('div');
                outputBlock.className = 'trace-payload';
                outputBlock.innerHTML = '<div class="trace-payload-label">输出</div><pre>' + this.escapeHtml(this.formatJson(span.outputPayload)) + '</pre>';
                item.appendChild(outputBlock);
            }

            timeline.appendChild(item);
        });

        panel.appendChild(timeline);
        return panel;
    }

    addThinkingToUI(traceId) {
        const messageElement = document.createElement('div');
        messageElement.className = 'message thinking-message';
        messageElement.setAttribute('data-trace-id', traceId);

        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.innerHTML = '<i class="fas fa-brain"></i>';

        const content = document.createElement('div');
        content.className = 'message-content';

        const text = document.createElement('div');
        text.className = 'message-text thinking-text';

        content.appendChild(text);
        messageElement.appendChild(avatar);
        messageElement.appendChild(content);

        this.elements.messagesContainer.appendChild(messageElement);
        this.scrollToBottom();

        return messageElement;
    }

    getCurrentModelLabel() {
        if (!this.currentModel) return null;
        const model = this.models.find(m => m.name === this.currentModel);
        return model ? (model.label || model.name) : this.currentModel;
    }

    renderThinking(element, trace) {
        const text = element.querySelector('.thinking-text');
        if (!text) return;

        text.innerHTML = '';

        const header = document.createElement('div');
        header.className = 'thinking-header';

        const status = (trace && trace.status) || 'running';
        const isRunning = status === 'running' || status === 'RUNNING';

        const modelLabel = this.getCurrentModelLabel();
        const modelBadge = modelLabel
            ? `<span class="thinking-model" title="本次使用模型"><i class="fas fa-microchip"></i> ${this.escapeHtml(modelLabel)}</span>`
            : '';

        header.innerHTML = `
            <span class="thinking-title"><i class="fas fa-brain"></i> 思考过程</span>
            ${modelBadge}
            <span class="thinking-status ${isRunning ? 'thinking-running' : 'thinking-done'}">
                ${isRunning ? '<i class="fas fa-circle-notch fa-spin"></i> 思考中' : '思考完成'}
            </span>
        `;
        text.appendChild(header);

        if (!trace || !trace.spans || trace.spans.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'thinking-empty';
            empty.textContent = '准备开始...';
            text.appendChild(empty);
        } else {
            const timeline = document.createElement('div');
            timeline.className = 'thinking-timeline';

            trace.spans.forEach(span => {
                const item = document.createElement('div');
                const spanStatus = (span.status || 'success').toLowerCase();
                item.className = `thinking-item thinking-status-${spanStatus}`;
                const statusIcon = spanStatus === 'running' ? '<i class="fas fa-circle-notch fa-spin"></i>' :
                    spanStatus === 'failed' ? '<i class="fas fa-times-circle"></i>' : '<i class="fas fa-check-circle"></i>';
                item.innerHTML = `
                    <span class="thinking-icon">${statusIcon}</span>
                    <span class="thinking-step-title">${this.escapeHtml(span.title || span.spanType)}</span>
                    <span class="thinking-step-meta">${span.costMillis || 0}ms</span>
                `;
                timeline.appendChild(item);
            });

            text.appendChild(timeline);
        }
    }

    addThinkingTraceButton(thinkingElement, traceId) {
        const text = thinkingElement.querySelector('.thinking-text');
        if (!text) return;

        const footer = document.createElement('div');
        footer.className = 'thinking-footer';

        const button = document.createElement('button');
        button.className = 'thinking-trace-btn';
        button.innerHTML = '<i class="fas fa-route"></i> 查看完整思考过程';
        button.onclick = () => {
            const existingPanel = text.querySelector('.trace-panel');
            if (existingPanel) {
                existingPanel.remove();
                button.innerHTML = '<i class="fas fa-route"></i> 查看完整思考过程';
            } else {
                this.loadTrace(traceId).then(trace => {
                    const panel = this.renderTracePanel(trace);
                    text.appendChild(panel);
                    button.innerHTML = '<i class="fas fa-route"></i> 隐藏完整思考过程';
                });
            }
        };

        footer.appendChild(button);
        text.appendChild(footer);
    }

    formatJson(payload) {
        if (!payload) return '';
        try {
            const obj = typeof payload === 'string' ? JSON.parse(payload) : payload;
            if (typeof obj === 'string') {
                return obj;
            }
            return JSON.stringify(obj, null, 2);
        } catch (e) {
            return String(payload);
        }
    }

    escapeHtml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
    
    formatTime(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        
        if (diff < 60000) return '刚刚';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
        
        const date = new Date(timestamp);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString().substring(0, 5);
    }
    
    openHistoryDrawer() {
        this.historyDrawerOpen = true;
        this.elements.historyDrawer.classList.add('show');
        this.elements.historyDrawerOverlay.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    closeHistoryDrawer() {
        this.historyDrawerOpen = false;
        this.elements.historyDrawer.classList.remove('show');
        this.elements.historyDrawerOverlay.classList.remove('show');
        document.body.style.overflow = '';
    }

    toggleHistoryDrawer() {
        if (this.historyDrawerOpen) {
            this.closeHistoryDrawer();
        } else {
            this.openHistoryDrawer();
        }
    }

    toggleTheme() {
        this.isDarkTheme = !this.isDarkTheme;
        document.body.classList.toggle('dark-theme', this.isDarkTheme);

        // 与 admin 全局主题同步
        if (window.App && App.setTheme) {
            App.setTheme(this.isDarkTheme ? 'dark' : 'light');
        }

        this.saveToStorage();
    }
    
    clearCurrentChat() {
        const currentChat = this.getCurrentChat();
        if (!currentChat) return;
        
        currentChat.messages = [];
        currentChat.title = '新对话';
        currentChat.updatedAt = Date.now();
        
        this.updateUI();
        this.saveToStorage();
        
        const welcomeMessage = {
            id: this.generateId(),
            role: 'assistant',
            content: '对话已清空。请问有什么可以帮助您的吗？',
            timestamp: Date.now()
        };
        
        currentChat.messages.push(welcomeMessage);
        this.addMessageToUI(welcomeMessage);
        this.saveToStorage();
    }
    
    async deleteChat(chatId) {
        try {
            const chat = this.chatHistory.find(c => c.id === chatId);
            if (chat) {
                chat.deleting = true;
                this.updateUI();
            }
            
            const response = await fetch(`${App.config.API_BASE}/chat/history/delete?userId=${this.userId}&sessionId=${chatId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.data === 'success') {
                await this.loadHistoryFromAPI();
                this.createNewChat();
            } else {
                throw new Error('删除失败');
            }
        } catch (error) {
            console.error('删除对话失败:', error);
            const chat = this.chatHistory.find(c => c.id === chatId);
            if (chat) {
                chat.deleting = false;
                this.updateUI();
            }
            alert('删除对话失败，请稍后再试');
        }
    }
    
    async switchToChat(chatId) {
        this.currentChatId = chatId;
        await this.loadChatDetail(chatId);
        this.updateUI();
        this.saveToStorage();
        this.closeHistoryDrawer();
        this.elements.messageInput.focus();
    }
    
    async loadChatDetail(sessionId) {
        try {
            const response = await fetch(`${App.config.API_BASE}/chat/history/detail?sessionId=${sessionId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            const chatDetails = result.data || [];
            
            const chat = this.chatHistory.find(c => c.id === sessionId);
            if (chat) {
                chat.messages = chatDetails.map(detail => ({
                    id: detail.id || this.generateId(),
                    role: detail.messageType === 'user' ? 'user' : 'assistant',
                    content: detail.textContent,
                    traceId: detail.traceId,
                    traceExpanded: false,
                    timestamp: new Date(detail.createTime).getTime()
                }));
            }
        } catch (error) {
            console.error('加载对话详情失败:', error);
            const chat = this.chatHistory.find(c => c.id === sessionId);
            if (chat && !chat.messages) {
                chat.messages = [];
            }
        }
    }
    
    getCurrentChat() {
        return this.chatHistory.find(chat => chat.id === this.currentChatId);
    }
    
    updateUI() {
        this.updateChatHistory();
        this.updateMessages();
        this.updateChatTitle();
        this.updateTheme();
    }

    updateChatHistory() {
        this.elements.historyList.innerHTML = '';

        if (this.chatHistory.length === 0) {
            this.elements.historyList.innerHTML = `
                <div class="history-empty">
                    <i class="fas fa-inbox" style="font-size: 32px; margin-bottom: 12px; opacity: 0.4;"></i>
                    <div>暂无历史会话</div>
                </div>
            `;
            return;
        }

        this.chatHistory.forEach(chat => {
            const item = document.createElement('button');
            item.className = 'history-item';
            item.classList.toggle('active', chat.id === this.currentChatId);
            if (chat.deleting) {
                item.classList.add('deleting');
            }

            const deleteIcon = chat.deleting ?
                '<i class="fas fa-spinner fa-spin"></i>' :
                '<i class="fas fa-trash"></i>';

            const deleteButtonDisabled = chat.deleting ? 'disabled' : '';
            const itemTitle = chat.deleting ? '正在删除...' : chat.title;
            // 格式化最后更新时间，删除中的会话不展示时间
            const timeText = chat.deleting ? '' : this.formatUpdateTime(chat.updatedAt || chat.createdAt);

            item.innerHTML = `
                <i class="fas fa-comment"></i>
                <!-- 标题与时间纵向排列，用 .history-item-content 包裹 -->
                <div class="history-item-content">
                    <span class="history-item-title">${itemTitle}</span>
                    ${timeText ? `<span class="history-item-time">${timeText}</span>` : ''}
                </div>
                <button class="delete-btn" ${deleteButtonDisabled} onclick="event.stopPropagation(); ${chat.deleting ? '' : `app.showDeleteChatConfirm('${chat.id}')`}">
                    ${deleteIcon}
                </button>
            `;

            if (!chat.deleting) {
                item.addEventListener('click', () => {
                    this.switchToChat(chat.id);
                });
            }

            this.elements.historyList.appendChild(item);
        });
    }
    
    updateMessages() {
        this.elements.messagesContainer.innerHTML = '';
        
        const currentChat = this.getCurrentChat();
        if (!currentChat) return;
        
        if (currentChat.messages.length === 0) {
            const welcomeMessage = {
                id: 'welcome',
                role: 'assistant',
                content: '你好！我是商业资产 AI 助手，可以协助你进行 REITs 分析、投决诊断、经营诊断等。请问有什么可以帮助您的吗？',
                timestamp: Date.now()
            };
            this.addMessageToUI(welcomeMessage);
        } else {
            currentChat.messages.forEach(message => {
                this.addMessageToUI(message);
            });
        }
    }
    
    updateChatTitle() {
        const currentChat = this.getCurrentChat();
        this.elements.chatTitle.textContent = currentChat ? currentChat.title : '商业资产 AI 对话助手';
    }
    
    updateTheme() {
        document.body.classList.toggle('dark-theme', this.isDarkTheme);
    }
    
    updateCharCount() {
        const length = this.elements.messageInput.value.length;
        this.elements.charCount.textContent = `${length}/2000`;
        
        if (length > 1800) {
            this.elements.charCount.style.color = '#ff4d4f';
        } else if (length > 1500) {
            this.elements.charCount.style.color = '#faad14';
        } else {
            this.elements.charCount.style.color = 'var(--text-tertiary)';
        }
    }
    
    updateSendButton() {
        const hasText = this.elements.messageInput.value.trim().length > 0;
        this.elements.sendBtn.disabled = !hasText || this.isTyping;
        
        const icon = this.elements.sendBtn.querySelector('i');
        if (this.isTyping) {
            icon.className = 'fas fa-circle-notch fa-spin';
            this.elements.sendBtn.title = 'AI正在回复中...';
            this.elements.messageInput.placeholder = 'AI正在回复中，请稍候...';
            this.elements.messageInput.disabled = true;
        } else {
            icon.className = 'fas fa-paper-plane';
            this.elements.sendBtn.title = '发送消息';
            this.elements.messageInput.placeholder = '输入您的问题...';
            this.elements.messageInput.disabled = false;
        }
    }
    
    autoResizeTextarea() {
        const textarea = this.elements.messageInput;
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }
    
    scrollToBottom() {
        setTimeout(() => {
            this.elements.messagesContainer.scrollTop = this.elements.messagesContainer.scrollHeight;
        }, 10);
    }
    
    showLoading() {
        this.elements.loadingIndicator.classList.add('show');
    }
    
    hideLoading() {
        this.elements.loadingIndicator.classList.remove('show');
    }
    
    showTypingIndicator(textElement) {
        textElement.classList.remove('typing-cursor');
        textElement.innerHTML = `
            <div class="typing-indicator">
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
                <span class="typing-text">AI正在思考中...</span>
            </div>
        `;
        textElement.classList.add('typing-waiting');
    }
    
    hideTypingIndicator(textElement) {
        textElement.classList.remove('typing-waiting');
        textElement.innerHTML = '';
    }
    
    showModal(title, message, onConfirm) {
        this.elements.modalTitle.textContent = title;
        this.elements.modalMessage.textContent = message;
        this.elements.modalOverlay.classList.add('show');
        
        this.elements.modalConfirm.replaceWith(this.elements.modalConfirm.cloneNode(true));
        this.elements.modalConfirm = document.getElementById('modalConfirm');
        
        this.elements.modalConfirm.addEventListener('click', () => {
            this.hideModal();
            if (onConfirm) onConfirm();
        });
    }
    
    hideModal() {
        this.elements.modalOverlay.classList.remove('show');
    }
    
    showDeleteChatConfirm(chatId) {
        const chat = this.chatHistory.find(c => c.id === chatId);
        if (!chat) return;
        
        this.showModal(
            '删除对话',
            `确定要删除对话"${chat.title}"吗？此操作不可撤销。`,
            async () => {
                await this.deleteChat(chatId);
            }
        );
    }
    
    handleResize() {
        if (window.innerWidth > 768) {
            return;
        }
        // 移动端若抽屉打开时横竖屏切换，保持可用即可
    }
    

    formatRelativeTime(timestamp) {
        if (!timestamp) return '';
        const now = Date.now();
        const diff = now - timestamp;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        if (seconds < 60) return '刚刚';
        if (minutes < 60) return `${minutes}分钟前`;
        if (hours < 24) return `${hours}小时前`;
        if (days < 7) return `${days}天前`;
        const date = new Date(timestamp);
        const month = date.getMonth() + 1;
        const day = date.getDate();
        return `${month}月${day}日`;
            /**
     * 将时间戳转换为友好的相对时间展示。
     * <1分钟 → 刚刚  |  <1小时 → X分钟前  |  <24小时 → X小时前
     * <7天 → X天前   |  更早 → 显示为 "X月X日"----w_xieboyu
     */
    }

    /**
     * 格式化聊天历史列表的"最近更新"时间。
     * 规则：今天→HH:mm | 昨天→昨天 | 本周内→周X | 本年内→MM-DD | 跨年→YYYY-MM-DD | null→"—"
     */
    formatUpdateTime(timestamp) {
        if (!timestamp) return '—';

        const now = new Date();
        const date = new Date(timestamp);

        // 今天 00:00:00
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        // 昨天 00:00:00
        const yesterdayStart = new Date(todayStart.getTime() - 86400000);
        // 本周一 00:00:00（周日视为本周最后一天）
        const dayOfWeek = now.getDay();
        const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const mondayStart = new Date(todayStart.getTime() - mondayOffset * 86400000);
        // 今年 01-01 00:00:00
        const yearStart = new Date(now.getFullYear(), 0, 1);

        if (date >= todayStart) {
            return String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
        }
        if (date >= yesterdayStart) {
            return '昨天';
        }
        if (date >= mondayStart) {
            const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
            return '周' + weekDays[date.getDay()];
        }
        if (date >= yearStart) {
            return String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
        }
        // 跨年
        return date.getFullYear() + '-' +
            String(date.getMonth() + 1).padStart(2, '0') + '-' +
            String(date.getDate()).padStart(2, '0');
    }

    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
    
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

let app;
document.addEventListener('DOMContentLoaded', async () => {
    app = new ChatApp();
    
    window.addEventListener('error', (e) => {
        console.error('应用错误:', e.error);
    });
    
    window.addEventListener('beforeunload', () => {
        if (app) {
            app.saveToStorage();
        }
    });
});

window.ChatApp = ChatApp;
