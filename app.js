// 全局变量
let apiKey = '';
let apiProvider = 'siliconflow';
let selectedModel = 'deepseek-ai/DeepSeek-V3';
let apiBaseUrl = '';
let chatHistory = [];
let isGenerating = false;

// 文档管理相关变量
let currentDocument = {
    id: '',
    title: '',
    content: '',
    lastModified: null,
    version: 1
};
let documentHistory = [];
let isAutoSaving = false;
let lastSavedContent = '';
let saveInterval = null;
const SAVE_INTERVAL_MS = 30000; // 30秒自动保存间隔

// 获取DOM元素
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const markdownEditor = document.getElementById('markdownEditor');
const confirmMarkdownBtn = document.getElementById('confirmMarkdownBtn');
const generateBtn = document.getElementById('generateBtn');
const copyMarkdownBtn = document.getElementById('copyMarkdownBtn');
const copyHtmlBtn = document.getElementById('copyHtmlBtn');
const styleDropdown = document.getElementById('styleDropdown');
const previewFrame = document.getElementById('previewFrame');
const chatStatus = document.getElementById('chatStatus');
const apiKeyBtn = document.getElementById('apiKeyBtn');
const apiKeyModal = document.getElementById('apiKeyModal');
const apiKeyInput = document.getElementById('apiKeyInput');
const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
const cancelApiKeyBtn = document.getElementById('cancelApiKeyBtn');
const apiStatusIcon = document.getElementById('apiStatusIcon');
const apiStatusText = document.getElementById('apiStatusText');
const apiProviderSelect = document.getElementById('apiProvider');
const modelSelect = document.getElementById('modelSelect');
const apiBaseUrlInput = document.getElementById('apiBaseUrl');
const apiUrlContainer = document.getElementById('apiUrlContainer');
// 新添加的元素
const writingStyleDropdown = document.getElementById('writingStyleDropdown');
const rewriteBtn = document.getElementById('rewriteBtn');
const translateBtn = document.getElementById('translateBtn');
const completeBtn = document.getElementById('completeBtn');
const editSelectedBtn = document.getElementById('editSelectedBtn');

// 初始化应用
async function initApp() {
    // 从localStorage加载API配置
    loadApiConfig();
    
    // 从localStorage加载文档历史
    loadDocumentHistory();
    
    // 如果有API密钥，验证其有效性
    if (apiKey) {
        try {
            updateApiStatus('validating');
            const isValid = await validateApiKey(apiKey, apiProvider, selectedModel, apiBaseUrl);
            if (isValid) {
                updateApiStatus('connected');
            } else {
                updateApiStatus('disconnected');
                showMessage('保存的API密钥已失效，请重新配置', 'warning');
            }
        } catch (error) {
            updateApiStatus('disconnected');
            console.error('API密钥验证失败:', error);
        }
    } else {
        updateApiStatus('disconnected');
    }
    
    // 设置自动保存
    setupAutoSave();
}

// 从localStorage加载API配置
function loadApiConfig() {
    apiKey = localStorage.getItem('wechat-formatter-api-key') || '';
    apiProvider = localStorage.getItem('wechat-formatter-api-provider') || 'siliconflow';
    selectedModel = localStorage.getItem('wechat-formatter-selected-model') || 'deepseek-ai/DeepSeek-V3';
    apiBaseUrl = localStorage.getItem('wechat-formatter-api-base-url') || '';
    
    // 更新UI显示
    if (apiProviderSelect) {
        apiProviderSelect.value = apiProvider;
        updateModelOptions(apiProvider);
        modelSelect.value = selectedModel;
        apiBaseUrlInput.value = apiBaseUrl;
        updateApiUrlVisibility();
    }
}

// 从localStorage加载文档历史
function loadDocumentHistory() {
    const savedHistory = localStorage.getItem('wechat-formatter-document-history');
    if (savedHistory) {
        try {
            documentHistory = JSON.parse(savedHistory);
        } catch (error) {
            console.error('加载文档历史失败:', error);
            documentHistory = [];
        }
    }
    
    // 如果有最后保存的文档，询问用户是否恢复
    const lastDocument = localStorage.getItem('wechat-formatter-last-document');
    if (lastDocument) {
        try {
            const doc = JSON.parse(lastDocument);
            if (doc.content && doc.content.trim()) {
                // 询问用户是否恢复上次编辑的内容
                const shouldRestore = confirm('检测到上次编辑的内容，是否恢复？');
                if (shouldRestore) {
                    currentDocument = doc;
                    markdownEditor.value = doc.content;
                    updatePreview();
                    showMessage('已恢复上次编辑的内容', 'success');
                }
            }
        } catch (error) {
            console.error('恢复上次文档失败:', error);
        }
    }
}

// 设置自动保存
function setupAutoSave() {
    // 监听编辑器内容变化
    markdownEditor.addEventListener('input', debounceAutoSave);
    
    // 页面卸载前保存
    window.addEventListener('beforeunload', saveCurrentDocument);
    
    // 定期自动保存
    saveInterval = setInterval(saveCurrentDocument, SAVE_INTERVAL_MS);
}

// 防抖自动保存
function debounceAutoSave() {
    if (isAutoSaving) return;
    
    clearTimeout(window.autoSaveTimeout);
    window.autoSaveTimeout = setTimeout(() => {
        saveCurrentDocument();
    }, 2000); // 2秒后自动保存
}

// 保存当前文档
function saveCurrentDocument() {
    if (isAutoSaving) return;
    
    isAutoSaving = true;
    const content = markdownEditor.value.trim();
    
    // 如果内容没有变化，不保存
    if (content === lastSavedContent) {
        isAutoSaving = false;
        return;
    }
    
    try {
        // 更新当前文档
        const now = new Date();
        currentDocument = {
            id: currentDocument.id || generateDocumentId(),
            title: extractTitle(content) || '无标题文档',
            content: content,
            lastModified: now.toISOString(),
            version: (currentDocument.version || 0) + 1
        };
        
        // 保存到localStorage
        localStorage.setItem('wechat-formatter-last-document', JSON.stringify(currentDocument));
        
        // 添加到历史记录
        addToHistory(currentDocument);
        
        // 更新最后保存的内容
        lastSavedContent = content;
        
        // 显示保存状态
        showSaveStatus('已自动保存');
    } catch (error) {
        console.error('保存文档失败:', error);
    } finally {
        isAutoSaving = false;
    }
}

// 生成文档ID
function generateDocumentId() {
    return 'doc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// 从内容中提取标题
function extractTitle(content) {
    // 尝试从Markdown中提取第一个#标题
    const titleMatch = content.match(/^#\s+(.+)$/m);
    if (titleMatch) {
        return titleMatch[1].trim();
    }
    
    // 如果没有标题，尝试提取第一行
    const lines = content.split('\n');
    if (lines.length > 0 && lines[0].trim()) {
        return lines[0].trim().substring(0, 30);
    }
    
    return null;
}

// 添加到历史记录
function addToHistory(document) {
    // 检查是否已存在相同ID的文档
    const existingIndex = documentHistory.findIndex(doc => doc.id === document.id);
    
    if (existingIndex !== -1) {
        // 更新现有文档
        documentHistory[existingIndex] = document;
    } else {
        // 添加新文档
        documentHistory.unshift(document);
    }
    
    // 限制历史记录数量
    if (documentHistory.length > 20) {
        documentHistory = documentHistory.slice(0, 20);
    }
    
    // 保存到localStorage
    localStorage.setItem('wechat-formatter-document-history', JSON.stringify(documentHistory));
}

// 显示保存状态
function showSaveStatus(message) {
    // 创建或更新保存状态指示器
    let saveStatus = document.getElementById('saveStatus');
    if (!saveStatus) {
        saveStatus = document.createElement('div');
        saveStatus.id = 'saveStatus';
        saveStatus.className = 'fixed bottom-4 right-4 bg-gray-800 text-white px-3 py-1 rounded text-sm opacity-0 transition-opacity duration-300';
        document.body.appendChild(saveStatus);
    }
    
    saveStatus.textContent = message;
    saveStatus.classList.remove('opacity-0');
    
    // 3秒后隐藏
    setTimeout(() => {
        saveStatus.classList.add('opacity-0');
    }, 3000);
}

// 手动保存文档
function saveDocument() {
    saveCurrentDocument();
    showMessage('文档已保存', 'success');
}

// 加载历史文档
function loadDocument(documentId) {
    const document = documentHistory.find(doc => doc.id === documentId);
    if (!document) {
        showMessage('文档不存在', 'error');
        return;
    }
    
    // 保存当前文档到历史
    if (markdownEditor.value.trim()) {
        saveCurrentDocument();
    }
    
    // 加载选中的文档
    currentDocument = document;
    markdownEditor.value = document.content;
    updatePreview();
    
    showMessage(`已加载文档: ${document.title}`, 'success');
}

// 显示文档历史
function showDocumentHistory() {
    // 创建历史记录模态框
    const modalHtml = `
        <div id="historyModal" class="modal">
            <div class="modal-content" style="max-width: 800px;">
                <div class="modal-header">
                    <h3>文档历史记录</h3>
                    <button id="closeHistoryModal" class="close-btn">&times;</button>
                </div>
                <div class="modal-body" style="max-height: 500px; overflow-y: auto;">
                    ${documentHistory.length === 0 ? 
                        '<p class="text-center text-gray-500">暂无历史文档</p>' :
                        documentHistory.map(doc => `
                            <div class="history-item" data-id="${doc.id}">
                                <div class="history-title">${doc.title}</div>
                                <div class="history-meta">
                                    <span class="history-date">${new Date(doc.lastModified).toLocaleString()}</span>
                                    <span class="history-version">版本 ${doc.version}</span>
                                </div>
                                <div class="history-preview">${doc.content.substring(0, 100)}${doc.content.length > 100 ? '...' : ''}</div>
                                <div class="history-actions">
                                    <button class="load-btn" data-id="${doc.id}">加载</button>
                                    <button class="delete-btn" data-id="${doc.id}">删除</button>
                                </div>
                            </div>
                        `).join('')
                    }
                </div>
                <div class="modal-footer">
                    <button id="clearHistoryBtn" class="btn-secondary">清空历史</button>
                    <button id="closeHistoryBtn" class="btn-primary">关闭</button>
                </div>
            </div>
        </div>
    `;
    
    // 添加模态框到页面
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // 获取模态框元素
    const historyModal = document.getElementById('historyModal');
    const closeHistoryModal = document.getElementById('closeHistoryModal');
    const closeHistoryBtn = document.getElementById('closeHistoryBtn');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');
    
    // 关闭模态框事件
    closeHistoryModal.addEventListener('click', () => {
        document.body.removeChild(historyModal);
    });
    
    closeHistoryBtn.addEventListener('click', () => {
        document.body.removeChild(historyModal);
    });
    
    // 清空历史事件
    clearHistoryBtn.addEventListener('click', () => {
        if (confirm('确定要清空所有历史记录吗？此操作不可恢复。')) {
            documentHistory = [];
            localStorage.removeItem('wechat-formatter-document-history');
            document.body.removeChild(historyModal);
            showMessage('历史记录已清空', 'success');
        }
    });
    
    // 加载文档事件
    document.querySelectorAll('.load-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const docId = btn.getAttribute('data-id');
            loadDocument(docId);
            document.body.removeChild(historyModal);
        });
    });
    
    // 删除文档事件
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const docId = btn.getAttribute('data-id');
            if (confirm('确定要删除这个文档吗？')) {
                documentHistory = documentHistory.filter(doc => doc.id !== docId);
                localStorage.setItem('wechat-formatter-document-history', JSON.stringify(documentHistory));
                
                // 如果删除的是当前文档，清空编辑器
                if (currentDocument.id === docId) {
                    currentDocument = {
                        id: '',
                        title: '',
                        content: '',
                        lastModified: null,
                        version: 1
                    };
                    markdownEditor.value = '';
                    updatePreview();
                }
                
                // 移除DOM元素
                btn.closest('.history-item').remove();
                
                // 如果没有历史记录了，显示空状态
                if (documentHistory.length === 0) {
                    document.querySelector('#historyModal .modal-body').innerHTML = '<p class="text-center text-gray-500">暂无历史文档</p>';
                }
                
                showMessage('文档已删除', 'success');
            }
        });
    });
    
    // 显示模态框
    historyModal.style.display = 'block';
}

// 初始化
document.addEventListener('DOMContentLoaded', async function() {
    console.log('DOMContentLoaded 事件触发');
    
    // 首先等待一小段时间确保DOM完全渲染
    await new Promise(resolve => setTimeout(resolve, 100));
    console.log('等待100ms后DOM应该已完全渲染');
    
    // 设置事件监听器
    console.log('调用 setupEventListeners');
    setupEventListeners();
    
    // 初始化API配置
    console.log('调用 initApp');
    await initApp();
    
    // 确保文档管理按钮已添加
    setTimeout(() => {
        console.log('延迟200ms后调用 addDocumentManagementButtons');
        addDocumentManagementButtons();
    }, 200);
});


// 设置事件监听器
function setupEventListeners() {
    // 聊天相关
    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    
    // Markdown编辑相关
    confirmMarkdownBtn.addEventListener('click', confirmMarkdown);
    generateBtn.addEventListener('click', generateFormattedContent);
    copyMarkdownBtn.addEventListener('click', copyMarkdown);
    copyHtmlBtn.addEventListener('click', copyHtml);
    
    // 风格选择
    styleDropdown.addEventListener('change', updatePreview);
    
    // API密钥相关
    apiKeyBtn.addEventListener('click', showApiKeyModal);
    saveApiKeyBtn.addEventListener('click', saveApiKey);
    cancelApiKeyBtn.addEventListener('click', hideApiKeyModal);
    
    // API提供商和模型选择
    apiProviderSelect.addEventListener('change', handleProviderChange);
    modelSelect.addEventListener('change', handleModelChange);
    
    // 新增功能按钮事件监听器
    rewriteBtn.addEventListener('click', rewriteContent);
    translateBtn.addEventListener('click', translateContent);
    completeBtn.addEventListener('click', completeContent);
    
    // 编辑选中部分事件监听器
    editSelectedBtn.addEventListener('click', editSelectedContent);
    
    // 文档保存和历史管理相关
    setupDocumentManagementListeners();
    
    // 监听Markdown编辑器变化
    markdownEditor.addEventListener('input', function() {
        if (markdownEditor.value.trim()) {
            updatePreview();
        }
    });
}

// 设置文档管理相关的事件监听器
function setupDocumentManagementListeners() {
    console.log('setupDocumentManagementListeners 被调用');
    
    // 添加保存按钮和历史按钮到UI（如果不存在）
    console.log('调用 addDocumentManagementButtons');
    addDocumentManagementButtons();
    
    // 设置保存按钮事件
    const saveBtn = document.getElementById('saveDocumentBtn');
    if (saveBtn) {
        console.log('找到保存按钮，添加点击事件');
        saveBtn.addEventListener('click', saveDocument);
    } else {
        console.log('未找到保存按钮');
    }
    
    // 设置历史按钮事件
    const historyBtn = document.getElementById('documentHistoryBtn');
    if (historyBtn) {
        console.log('找到历史按钮，添加点击事件');
        historyBtn.addEventListener('click', showDocumentHistory);
    } else {
        console.log('未找到历史按钮');
    }
    
    // 设置新建文档按钮事件
    const newDocBtn = document.getElementById('newDocumentBtn');
    if (newDocBtn) {
        console.log('找到新建文档按钮，添加点击事件');
        newDocBtn.addEventListener('click', createNewDocument);
    } else {
        console.log('未找到新建文档按钮');
    }
}

// 添加文档管理按钮到UI
function addDocumentManagementButtons() {
    console.log('addDocumentManagementButtons 被调用');
    
    // 检查是否已添加按钮
    if (document.getElementById('saveDocumentBtn')) {
        console.log('按钮已存在，无需重复添加');
        return; // 按钮已存在，无需重复添加
    }
    
    // 查找编辑器元素
    const editor = document.getElementById('markdownEditor');
    if (!editor) {
        console.error('无法找到编辑器元素');
        return;
    }
    console.log('找到编辑器元素:', editor);
    
    // 查找编辑器的父容器
    const editorContainer = editor.parentElement;
    if (!editorContainer) {
        console.error('无法找到编辑器容器');
        return;
    }
    console.log('找到编辑器容器:', editorContainer);
    
    // 创建文档管理按钮容器
    const docButtonsContainer = document.createElement('div');
    docButtonsContainer.className = 'document-management-buttons';
    docButtonsContainer.style.cssText = 'display: flex; gap: 8px; margin-bottom: 10px; justify-content: center;';
    
    // 创建保存按钮
    const saveBtn = document.createElement('button');
    saveBtn.id = 'saveDocumentBtn';
    saveBtn.className = 'px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-md transition-colors duration-200 flex items-center';
    saveBtn.innerHTML = '<i class="fas fa-save mr-1"></i> 保存文档';
    saveBtn.title = '保存当前文档';
    
    // 创建历史按钮
    const historyBtn = document.createElement('button');
    historyBtn.id = 'documentHistoryBtn';
    historyBtn.className = 'px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-sm rounded-md transition-colors duration-200 flex items-center';
    historyBtn.innerHTML = '<i class="fas fa-history mr-1"></i> 文档历史';
    historyBtn.title = '查看文档历史记录';
    
    // 创建新建文档按钮
    const newDocBtn = document.createElement('button');
    newDocBtn.id = 'newDocumentBtn';
    newDocBtn.className = 'px-3 py-1 bg-purple-500 hover:bg-purple-600 text-white text-sm rounded-md transition-colors duration-200 flex items-center';
    newDocBtn.innerHTML = '<i class="fas fa-file mr-1"></i> 新建文档';
    newDocBtn.title = '创建新文档';
    
    // 添加按钮到容器
    docButtonsContainer.appendChild(saveBtn);
    docButtonsContainer.appendChild(historyBtn);
    docButtonsContainer.appendChild(newDocBtn);
    
    // 将容器插入到编辑器的前面
    editorContainer.insertBefore(docButtonsContainer, editor);
    console.log('按钮容器已插入到编辑器前面');
    
    // 添加按钮样式
    const style = document.createElement('style');
    style.textContent = `
        .history-item {
            border: 1px solid #e0e0e0;
            border-radius: 6px;
            padding: 12px;
            margin-bottom: 10px;
            background-color: #f9f9f9;
        }
        
        .history-title {
            font-weight: bold;
            font-size: 16px;
            margin-bottom: 5px;
        }
        
        .history-meta {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            color: #666;
            margin-bottom: 8px;
        }
        
        .history-preview {
            font-size: 14px;
            color: #333;
            margin-bottom: 10px;
            max-height: 60px;
            overflow: hidden;
        }
        
        .history-actions {
            display: flex;
            gap: 8px;
        }
        
        .history-actions button {
            padding: 4px 8px;
            font-size: 12px;
            border-radius: 4px;
            cursor: pointer;
        }
        
        .load-btn {
            background-color: #4CAF50;
            color: white;
            border: none;
        }
        
        .delete-btn {
            background-color: #f44336;
            color: white;
            border: none;
        }
    `;
    document.head.appendChild(style);
    console.log('样式已添加到文档头部');
}

// 完成内容
async function completeContent() {
    const selectedText = getSelectedText();
    const prompt = selectedText || markdownEditor.value;
    
    if (!prompt.trim()) {
        showMessage('请先输入或选择一些内容', 'warning');
        return;
    }
    
    try {
        isGenerating = true;
        completeBtn.disabled = true;
        completeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 完成中...';
        
        const response = await fetchApi('/chat/completions', {
            model: selectedModel,
            messages: [
                {
                    role: 'system',
                    content: '你是一个专业的内容创作者，擅长将不完整的内容补充完整，使其更加丰富和完整。请根据用户提供的内容，进行合理的补充和扩展，保持原有风格和意图。'
                },
                {
                    role: 'user',
                    content: `请帮我完成以下内容：\n\n${prompt}`
                }
            ],
            temperature: 0.7,
            max_tokens: 2000
        });
        
        const completedContent = response.choices[0].message.content;
        
        if (selectedText) {
            // 如果有选中文本，替换选中的部分
            replaceSelectedText(completedContent);
        } else {
            // 如果没有选中文本，替换整个编辑器内容
            markdownEditor.value = completedContent;
        }
        
        updatePreview();
        showMessage('内容已完成', 'success');
    } catch (error) {
        console.error('完成内容失败:', error);
        showMessage('完成内容失败，请重试', 'error');
    } finally {
        isGenerating = false;
        completeBtn.disabled = false;
        completeBtn.innerHTML = '完成内容';
    }
}

// 获取选中的文本
function getSelectedText() {
    const textarea = markdownEditor;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    return textarea.value.substring(start, end);
}

// 创建新文档
function createNewDocument() {
    // 保存当前文档
    if (markdownEditor.value.trim()) {
        saveCurrentDocument();
    }
    
    // 重置当前文档
    currentDocument = {
        id: '',
        title: '',
        content: '',
        lastModified: null,
        version: 1
    };
    
    // 清空编辑器
    markdownEditor.value = '';
    updatePreview();
    
    showMessage('已创建新文档', 'success');
}

// 替换选中的文本
function replaceSelectedText(newText) {
    const textarea = markdownEditor;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const beforeText = text.substring(0, start);
    const afterText = text.substring(end, text.length);
    
    textarea.value = beforeText + newText + afterText;
    
    // 设置光标位置到替换文本的末尾
    const newCursorPos = start + newText.length;
    textarea.setSelectionRange(newCursorPos, newCursorPos);
    textarea.focus();
}

// 显示API密钥模态框
function showApiKeyModal() {
    apiKeyModal.classList.remove('hidden');
    
    // 设置当前值
    apiKeyInput.value = apiKey;
    apiProviderSelect.value = apiProvider;
    modelSelect.value = selectedModel;
    apiBaseUrlInput.value = apiBaseUrl;
    
    // 根据提供商显示/隐藏API基础URL输入框
    updateApiUrlVisibility();
    
    apiKeyInput.focus();
}

// 隐藏API密钥模态框
function hideApiKeyModal() {
    apiKeyModal.classList.add('hidden');
}

// 处理提供商变更
function handleProviderChange() {
    const provider = apiProviderSelect.value;
    
    // 更新模型选项
    updateModelOptions(provider);
    
    // 更新API基础URL可见性
    updateApiUrlVisibility();
}

// 处理模型变更
function handleModelChange() {
    // 如果选择了自定义模型，显示API基础URL输入框
    if (modelSelect.value === 'custom') {
        apiUrlContainer.classList.remove('hidden');
    } else {
        apiUrlContainer.classList.add('hidden');
    }
}

// 更新模型选项
function updateModelOptions(provider) {
    // 清空当前选项
    modelSelect.innerHTML = '';
    
    // 根据提供商添加模型选项
    if (provider === 'siliconflow') {
        modelSelect.innerHTML = `
            <optgroup label="DeepSeek系列">
                <option value="deepseek-ai/DeepSeek-V3.2-Exp">DeepSeek-V3.2-Exp (最新)</option>
                <option value="deepseek-ai/DeepSeek-R1">DeepSeek-R1</option>
                <option value="deepseek-ai/DeepSeek-V3">DeepSeek-V3</option>
                <option value="deepseek-ai/DeepSeek-V2.5">DeepSeek-V2.5</option>
            </optgroup>
            <optgroup label="GLM系列">
                <option value="zai-org/GLM-4.6">GLM-4.6</option>
                <option value="THUDM/glm-4-9b-chat">GLM-4-9B-Chat</option>
                <option value="THUDM/chatglm3-6b">ChatGLM3-6B</option>
            </optgroup>
            <optgroup label="Qwen系列">
                <option value="Qwen/Qwen3-VL-8B-Instruct">Qwen3-VL-8B-Instruct</option>
                <option value="Qwen/Qwen2.5-7B-Instruct">Qwen2.5-7B-Instruct</option>
                <option value="Qwen/Qwen2.5-14B-Instruct">Qwen2.5-14B-Instruct</option>
                <option value="Qwen/Qwen2.5-32B-Instruct">Qwen2.5-32B-Instruct</option>
                <option value="Qwen/Qwen2.5-72B-Instruct">Qwen2.5-72B-Instruct</option>
            </optgroup>
            <optgroup label="Llama系列">
                <option value="meta-llama/Meta-Llama-3.1-8B-Instruct">Llama-3.1-8B-Instruct</option>
                <option value="meta-llama/Meta-Llama-3.1-70B-Instruct">Llama-3.1-70B-Instruct</option>
            </optgroup>
            <optgroup label="其他模型">
                <option value="01-ai/Yi-1.5-9B-Chat-16K">Yi-1.5-9B-Chat-16K</option>
                <option value="01-ai/Yi-1.5-34B-Chat-16K">Yi-1.5-34B-Chat-16K</option>
                <option value="internlm/internlm2_5-7b-chat">InternLM2.5-7B-Chat</option>
                <option value="internlm/internlm2_5-20b-chat">InternLM2.5-20B-Chat</option>
            </optgroup>
        `;
    } else if (provider === 'openai') {
        modelSelect.innerHTML = `
            <optgroup label="OpenAI模型">
                <option value="gpt-4">GPT-4</option>
                <option value="gpt-4-turbo">GPT-4 Turbo</option>
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
            </optgroup>
        `;
    } else if (provider === 'custom') {
        modelSelect.innerHTML = `
            <optgroup label="自定义">
                <option value="custom">自定义模型</option>
            </optgroup>
        `;
    }
    
    // 设置默认选择
    modelSelect.value = selectedModel;
}

// 更新API基础URL可见性
function updateApiUrlVisibility() {
    const provider = apiProviderSelect.value;
    const model = modelSelect.value;
    
    if (provider === 'custom' || model === 'custom') {
        apiUrlContainer.classList.remove('hidden');
    } else {
        apiUrlContainer.classList.add('hidden');
    }
}

// 保存API密钥
async function saveApiKey() {
    const newApiKey = apiKeyInput.value.trim();
    const newProvider = apiProviderSelect.value;
    const newModel = modelSelect.value;
    const newBaseUrl = apiBaseUrlInput.value.trim();
    
    if (!newApiKey) {
        showMessage('请输入API密钥', 'error');
        return;
    }
    
    if (!newModel || newModel === 'custom') {
        showMessage('请选择或输入模型名称', 'error');
        return;
    }
    
    // 更新API状态为验证中
    updateApiStatus('validating');
    
    try {
        // 验证API密钥
        const isValid = await validateApiKey(newApiKey, newProvider, newModel, newBaseUrl);
        
        if (isValid) {
            // 保存到localStorage
            localStorage.setItem('wechat-formatter-api-key', newApiKey);
            localStorage.setItem('wechat-formatter-api-provider', newProvider);
            localStorage.setItem('wechat-formatter-selected-model', newModel);
            localStorage.setItem('wechat-formatter-api-base-url', newBaseUrl);
            
            // 更新全局变量
            apiKey = newApiKey;
            apiProvider = newProvider;
            selectedModel = newModel;
            apiBaseUrl = newBaseUrl;
            
            // 更新API状态为已连接
            updateApiStatus('connected');
            
            hideApiKeyModal();
            showMessage('API配置已保存并验证成功', 'success');
        } else {
            // 更新API状态为未连接
            updateApiStatus('disconnected');
            showMessage('API密钥验证失败，请检查配置', 'error');
        }
    } catch (error) {
        // 更新API状态为未连接
        updateApiStatus('disconnected');
        showMessage(`API配置验证失败: ${error.message}`, 'error');
    }
}

// 更新API状态显示
function updateApiStatus(status) {
    if (status === 'connected') {
        apiStatusIcon.className = 'fas fa-circle mr-1 text-green-500';
        apiStatusText.textContent = '已连接';
    } else if (status === 'disconnected') {
        apiStatusIcon.className = 'fas fa-circle mr-1 text-red-500';
        apiStatusText.textContent = '未连接';
    } else if (status === 'validating') {
        apiStatusIcon.className = 'fas fa-circle mr-1 text-yellow-500';
        apiStatusText.textContent = '验证中...';
    }
}

// 验证API密钥是否有效
async function validateApiKey(apiKeyToTest, provider, model, baseUrl) {
    try {
        // 确定API基础URL
        let apiUrl;
        if (baseUrl) {
            apiUrl = baseUrl;
        } else if (provider === 'siliconflow') {
            apiUrl = 'https://api.siliconflow.cn/v1/chat/completions';
        } else if (provider === 'openai') {
            apiUrl = 'https://api.openai.com/v1/chat/completions';
        } else {
            throw new Error('未知的API提供商');
        }
        
        console.log(`验证API: ${provider}, 模型: ${model}, URL: ${apiUrl}`);
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKeyToTest}`
            },
            body: JSON.stringify({
                model: model,
                messages: [{ role: 'user', content: '测试连接' }],
                max_tokens: 10
            })
        });
        
        console.log(`API响应状态: ${response.status}`);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('API错误响应:', errorData);
            throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
        }
        
        const responseData = await response.json();
        console.log('API验证成功:', responseData);
        
        return true;
    } catch (error) {
        console.error('API密钥验证出错:', error);
        throw error;
    }
}

// 发送消息
async function sendMessage() {
    const message = chatInput.value.trim();
    if (!message || isGenerating) return;
    
    // 检查API是否已配置
    if (!apiKey) {
        showMessage('请先配置API密钥', 'error');
        showApiKeyModal();
        return;
    }
    
    // 添加用户消息到聊天记录
    addChatMessage(message, 'user');
    chatInput.value = '';
    
    // 显示加载状态
    isGenerating = true;
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<div class="loading-spinner"></div>';
    chatStatus.textContent = 'AI思考中...';
    
    try {
        // 检查是否是路径选择
        const isPathSelection = (message.toLowerCase() === 'a' || message.toLowerCase() === 'b') && 
                               chatHistory.some(msg => msg.sender === 'ai' && msg.message.includes('请用户选择【路径A】还是【路径B】'));
        
        let response;
        
        if (isPathSelection) {
            // 路径选择处理
            if (message.toLowerCase() === 'b') {
                // 路径B：闪电出稿模式
                chatStatus.textContent = '闪电出稿模式启动中...';
                
                // 静默执行3-8步，生成完整Markdown
                const fullArticle = await generateFullArticle();
                
                // 添加确认消息
                addChatMessage('没问题！【闪电出稿模式】已启动。请稍候，我正在为你构建全文...', 'ai');
                
                // 模拟思考过程
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // 添加交付消息
                addChatMessage('...（AI思考中）...', 'ai');
                await new Promise(resolve => setTimeout(resolve, 1500));
                
                // 添加完成消息
                addChatMessage('**交付完成！**\n\n一篇基于"9步法"的高质量初稿已在【中侧编辑区】生成。这已经是**一个可以发表的80分版本**。\n\n接下来，**我们将启动【第9步：爆款品控】**。我将自动对照【7关键点】进行审核，然后在【左侧这里】给你修改建议，我们一起把它打磨到95分。', 'ai');
                
                // 同步完整文章到编辑器
                syncToEditor(fullArticle);
                
                // 启动第9步：爆款品控
                setTimeout(() => {
                    startQualityControl(fullArticle);
                }, 1000);
                
                return;
            } else {
                // 路径A：架构师模式
                addChatMessage('好的，我们选择【架构师模式】。现在，我们来设计"标题钩子"...', 'ai');
                
                // 构建架构师模式上下文
                const conversationContext = buildConversationContext(message);
                response = await callAI(conversationContext);
            }
        } else {
            // 正常对话流程
            const conversationContext = buildConversationContext(message);
            response = await callAI(conversationContext);
        }
        
        // 添加AI回复到聊天记录
        if (response) {
            addChatMessage(response, 'ai');
            
            // 自动同步到编辑器（如果是生成的内容）
            if (response.includes('生成') || response.includes('创作') || response.includes('文章')) {
                setTimeout(() => {
                    syncToEditor(response);
                }, 500);
            }
            
            // 检查是否需要启动品控（路径A完成后自动启动）
            setTimeout(() => {
                checkAndStartQualityControl();
            }, 500);
        }
    } catch (error) {
        console.error('AI调用失败:', error);
        
        // 根据错误类型显示不同的错误消息
        let errorMessage = '抱歉，AI服务暂时不可用，请稍后再试。';
        
        if (error.message.includes('API密钥未配置')) {
            errorMessage = 'API密钥未配置，请点击右上角"配置API"按钮进行配置。';
        } else if (error.message.includes('401')) {
            errorMessage = 'API密钥无效，请检查您的API密钥是否正确。';
        } else if (error.message.includes('404')) {
            errorMessage = '模型不存在，请选择其他模型或检查API配置。';
        } else if (error.message.includes('429')) {
            errorMessage = 'API请求频率过高，请稍后再试。';
        } else if (error.message.includes('500') || error.message.includes('502') || error.message.includes('503')) {
            errorMessage = 'API服务器错误，请稍后再试。';
        }
        
        addChatMessage(errorMessage, 'ai');
        showMessage(errorMessage, 'error');
    } finally {
        // 恢复状态
        isGenerating = false;
        sendBtn.disabled = false;
        sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
        chatStatus.textContent = '就绪';
    }
}

// 构建对话上下文，实现公众号爆款内容架构师工作流
function buildConversationContext(userMessage) {
    // 获取对话历史（最近3轮对话）
    const recentHistory = chatHistory.slice(-6); // 最近3轮对话（每轮2条消息）
    
    let context = '';
    
    // 判断当前工作流阶段
    const isFirstStep = chatHistory.length <= 1;
    const hasPainPointInfo = chatHistory.some(msg => 
        msg.sender === 'user' && (msg.message.includes('目标读者') || msg.message.includes('核心焦虑') || 
        msg.message.includes('宝妈') || msg.message.includes('00后') || msg.message.includes('焦虑'))
    );
    const hasValueAnchor = chatHistory.some(msg => 
        msg.sender === 'user' && (msg.message.includes('价值主张') || msg.message.includes('解药') || 
        msg.message.includes('收获') || msg.message.includes('解决方案'))
    );
    const hasPathSelection = chatHistory.some(msg => 
        msg.sender === 'user' && (msg.message.toLowerCase() === 'a' || msg.message.toLowerCase() === 'b')
    );
    const isPathA = chatHistory.some(msg => 
        msg.sender === 'user' && msg.message.toLowerCase() === 'a'
    );
    const isPathB = chatHistory.some(msg => 
        msg.sender === 'user' && msg.message.toLowerCase() === 'b'
    );
    
    // 如果是第一轮对话，启动爆款内容架构师工作流
    if (isFirstStep) {
        context = `你是一名专业的公众号爆款内容架构师AI助手。你的核心使命是帮助用户高效产出爆款文章。

当前写作风格：${getWritingStyleName(writingStyleDropdown.value)}

【第1步：痛点锁定】
一篇爆款的起点，不是文采，而是精准的"痛点"。请告诉我：
1. 目标读者：比如，是30-40岁的焦虑宝妈？还是刚入职场的00后？
2. 核心焦虑：他们深夜睡不着时，脑子里在循环的那个具体问题是什么？

用户需求：${userMessage}`;
    } 
    // 如果用户已经提供了痛点信息，进入第2步：价值锚点
    else if (hasPainPointInfo && !hasValueAnchor) {
        context = `你是一名专业的公众号爆款内容架构师AI助手。

当前写作风格：${getWritingStyleName(writingStyleDropdown.value)}

【第2步：价值锚点】
非常好，痛点抓得很准。读者不是来看问题的，是来找解药的。我们的"解药"（即价值主张）必须是独家且诱人的。

请用户用一句话概括：读者读完后最大的收获是什么？

对话历史：
${recentHistory.map(msg => `${msg.sender === 'user' ? '您' : 'AI助手'}: ${msg.message}`).join('\n')}

当前需求：${userMessage}`;
    }
    // 如果用户已经提供了价值锚点，进入关键决策点
    else if (hasValueAnchor && !hasPathSelection) {
        context = `你是一名专业的公众号爆款内容架构师AI助手。

当前写作风格：${getWritingStyleName(writingStyleDropdown.value)}

【关键决策点】
太棒了！我们已经锁定了爆款的"魂"（痛点+价值）。现在，我们有两种合作模式，请用户选择：

【路径A：架构师模式】（精雕细琢）
用户来主导，AI来辅助。一步步引导完成标题、大纲、导语和内容，共同打磨每一个细节。这最能体现用户的个人风格。

【路径B：闪电出稿模式】（快速交付）
AI来主导，用户来审阅。立即在编辑区生成一篇基于"9步法"的、可直接发表的80分专业初稿，然后用户再告诉AI哪里需要修改。

请用户选择【路径A】还是【路径B】？（回复A或B即可）

对话历史：
${recentHistory.map(msg => `${msg.sender === 'user' ? '您' : 'AI助手'}: ${msg.message}`).join('\n')}

当前需求：${userMessage}`;
    }
    // 如果用户选择了路径A，进入架构师模式的具体步骤
    else if (isPathA) {
        // 根据对话历史判断当前步骤
        const hasTitleHook = chatHistory.some(msg => 
            msg.sender === 'ai' && msg.message.includes('标题钩子')
        );
        const hasArticleFramework = chatHistory.some(msg => 
            msg.sender === 'ai' && msg.message.includes('文章框架')
        );
        const hasIntroduction = chatHistory.some(msg => 
            msg.sender === 'ai' && msg.message.includes('导语开场')
        );
        const hasContent = chatHistory.some(msg => 
            msg.sender === 'ai' && msg.message.includes('正文内容')
        );
        const hasGoldenSentence = chatHistory.some(msg => 
            msg.sender === 'ai' && msg.message.includes('金句提炼')
        );
        const hasCTA = chatHistory.some(msg => 
            msg.sender === 'ai' && msg.message.includes('结尾CTA')
        );
        
        let currentStep = '';
        
        if (!hasTitleHook) {
            currentStep = '【第3步：标题钩子】\n现在我们来设计"标题钩子"。一个好的标题应该：\n1. 吸引目标读者眼球\n2. 暗示文章价值\n3. 激发好奇心\n\n请告诉我您想要的标题方向或关键词？';
        } else if (!hasArticleFramework) {
            currentStep = '【第4步：文章框架】\n标题很棒！接下来设计文章框架。请告诉我：\n1. 文章的主要论点是什么？\n2. 需要几个部分来展开论述？\n3. 每个部分的重点是什么？';
        } else if (!hasIntroduction) {
            currentStep = '【第5步：导语开场】\n框架很清晰！现在设计导语开场。一个好的导语应该：\n1. 引发读者共鸣\n2. 点明文章价值\n3. 吸引继续阅读\n\n您希望导语侧重哪个方面？';
        } else if (!hasContent) {
            currentStep = '【第6步：正文内容】\n导语很吸引人！现在填充正文内容。请告诉我：\n1. 每个部分的具体内容要点\n2. 需要哪些案例或数据支持？\n3. 如何层层递进展开论述？';
        } else if (!hasGoldenSentence) {
            currentStep = '【第7步：金句提炼】\n正文内容很充实！现在提炼金句。请告诉我：\n1. 文章中最核心的观点是什么？\n2. 哪些句子适合做成金句传播？\n3. 希望金句传达什么价值？';
        } else if (!hasCTA) {
            currentStep = '【第8步：结尾CTA】\n金句很精彩！现在设计结尾和行动号召。请告诉我：\n1. 希望读者读完文章后做什么？\n2. 结尾要强调什么核心价值？\n3. 是否需要设置互动环节？';
        } else {
            currentStep = '【第9步：爆款品控】\n文章已经基本完成！现在进行品控检查。我将对照7个关键点进行自检，然后给您优化建议。';
        }
        
        context = `你是一名专业的公众号爆款内容架构师AI助手。

当前写作风格：${getWritingStyleName(writingStyleDropdown.value)}

${currentStep}

对话历史：
${recentHistory.map(msg => `${msg.sender === 'user' ? '您' : 'AI助手'}: ${msg.message}`).join('\n')}

当前需求：${userMessage}`;
    }
    // 其他多轮对话
    else {
        context = `继续我们的爆款内容创作流程，我将基于之前的讨论为您提供进一步的优化建议。

对话历史：
${recentHistory.map(msg => `${msg.sender === 'user' ? '您' : 'AI助手'}: ${msg.message}`).join('\n')}

当前需求：${userMessage}`;
    }
    
    return context;
}

// 获取写作风格名称
function getWritingStyleName(styleValue) {
    const styleMap = {
        'default': '默认风格',
        'simple': '自然风格',
        'kazik': '卡兹克风格',
        'lively': '活泼风格',
        'professional': '专业风格',
        'humorous': '幽默风格'
    };
    return styleMap[styleValue] || '默认风格';
}

// 生成完整文章（路径B：闪电出稿模式）
async function generateFullArticle() {
    try {
        // 获取对话历史中的痛点信息和价值锚点
        const painPointInfo = chatHistory.find(msg => 
            msg.sender === 'user' && (msg.message.includes('目标读者') || msg.message.includes('核心焦虑'))
        );
        
        const valueAnchorInfo = chatHistory.find(msg => 
            msg.sender === 'user' && (msg.message.includes('价值主张') || msg.message.includes('解药') || msg.message.includes('收获'))
        );
        
        // 构建闪电出稿模式的系统提示
        const systemPrompt = `你是一名专业的公众号爆款内容架构师。请基于以下信息，静默执行【第3步】到【第8步】，生成一篇完整的公众号文章：

【痛点信息】: ${painPointInfo ? painPointInfo.message : '用户提供的痛点信息'}
【价值锚点】: ${valueAnchorInfo ? valueAnchorInfo.message : '用户提供的价值主张'}

请按照9步法生成一篇高质量的公众号文章：
1. 标题钩子（吸引眼球）
2. 文章框架（逻辑清晰）
3. 导语开场（引发共鸣）
4. 正文内容（价值传递）
5. 金句提炼（传播性强）
6. 结尾CTA（引导行动）

要求：
- 字数控制在1500-2000字
- 使用Markdown格式
- 包含标题、小标题、正文、金句、结尾
- 语言生动，有感染力
- 符合公众号爆款标准`;
        
        // 调用AI生成完整文章
        const fullArticle = await callAI(systemPrompt, 'generate');
        return fullArticle;
        
    } catch (error) {
        console.error('生成完整文章失败:', error);
        return '抱歉，生成完整文章时出现错误，请稍后再试。';
    }
}

// 启动第9步：爆款品控
async function startQualityControl(article) {
    try {
        // 构建品控系统提示
        const systemPrompt = `你是一名专业的公众号内容品控专家。请对以下文章进行【7关键点自检】：

1. **情绪价值**：文章是否能引发读者情感共鸣？
2. **实用性/信息差**：是否提供了有价值的信息或独特见解？
3. **标题吸引力**：标题是否能吸引目标读者点击？
4. **结构逻辑**：文章结构是否清晰，逻辑是否通顺？
5. **语言表达**：语言是否生动，表达是否准确？
6. **传播性**：是否有易于传播的金句或观点？
7. **行动引导**：结尾是否有明确的行动号召？

请对每个关键点进行评分（✅ 高分 / ⚠️ 中 / ❌ 低分），并提供具体的优化建议。

文章内容：${article}`;
        
        // 调用AI进行品控分析
        const qualityReport = await callAI(systemPrompt, 'generate');
        
        // 添加品控报告到聊天记录
        setTimeout(() => {
            addChatMessage(`（AI阅读中...）\n**【7关键点自检报告】已出炉：**\n\n${qualityReport}\n\n**【架构师建议】**：整体是80-85分。我们重点优化[xxx]和[xxx]，你希望我先帮你修改中栏的哪个段落？`, 'ai');
        }, 1000);
        
    } catch (error) {
        console.error('品控分析失败:', error);
        addChatMessage('抱歉，品控分析时出现错误，请稍后再试。', 'ai');
    }
}

// 检查是否需要启动品控（用于路径A的自动品控）
function checkAndStartQualityControl() {
    // 检查是否完成了路径A的所有步骤
    const hasTitleHook = chatHistory.some(msg => 
        msg.sender === 'ai' && msg.message.includes('标题钩子')
    );
    const hasArticleFramework = chatHistory.some(msg => 
        msg.sender === 'ai' && msg.message.includes('文章框架')
    );
    const hasIntroduction = chatHistory.some(msg => 
        msg.sender === 'ai' && msg.message.includes('导语开场')
    );
    const hasContent = chatHistory.some(msg => 
        msg.sender === 'ai' && msg.message.includes('正文内容')
    );
    const hasGoldenSentence = chatHistory.some(msg => 
        msg.sender === 'ai' && msg.message.includes('金句提炼')
    );
    const hasCTA = chatHistory.some(msg => 
        msg.sender === 'ai' && msg.message.includes('结尾CTA')
    );
    
    // 如果所有步骤都已完成，启动品控
    if (hasTitleHook && hasArticleFramework && hasIntroduction && 
        hasContent && hasGoldenSentence && hasCTA) {
        
        // 获取当前编辑器内容
        const articleContent = markdownEditor.value;
        if (articleContent && articleContent.trim().length > 0) {
            setTimeout(() => {
                startQualityControl(articleContent);
            }, 1000);
        }
    }
}

// 同步消息到编辑器
function syncToEditor(message) {
    // 检查消息是否包含文章内容（避免同步引导性消息）
    const isArticleContent = message && 
        (message.includes('标题') || message.includes('正文') || 
         message.includes('内容') || message.includes('文章') ||
         message.length > 100); // 长文本通常是文章内容
    
    if (isArticleContent) {
        // 如果是文章内容，直接替换编辑器内容
        markdownEditor.value = message;
        updatePreview();
        showMessage('内容已同步到编辑器', 'success');
        
        // 触发输入事件，确保自动保存生效
        markdownEditor.dispatchEvent(new Event('input'));
    }
}

// 添加聊天消息
function addChatMessage(message, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    
    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'message-bubble';
    bubbleDiv.textContent = message;
    
    const metaDiv = document.createElement('div');
    metaDiv.className = 'message-meta';
    
    // 创建时间戳
    const timeSpan = document.createElement('span');
    timeSpan.textContent = sender === 'user' ? '您 · 刚刚' : 'AI助手 · 刚刚';
    metaDiv.appendChild(timeSpan);
    
    // 如果是AI消息，添加操作按钮
    if (sender === 'ai') {
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'message-actions';
        
        // 添加同步到编辑器按钮
        const syncBtn = document.createElement('button');
        syncBtn.className = 'message-action-button';
        syncBtn.innerHTML = '<i class="fas fa-sync-alt"></i> 同步到编辑器';
        syncBtn.onclick = () => syncToEditor(message);
        
        actionsDiv.appendChild(syncBtn);
        metaDiv.appendChild(actionsDiv);
    }
    
    messageDiv.appendChild(bubbleDiv);
    messageDiv.appendChild(metaDiv);
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // 保存到聊天历史
    chatHistory.push({ sender, message });
}

// 调用AI API
async function callAI(message, action = 'generate', style = null) {
    try {
        // 检查API密钥是否存在
        if (!apiKey) {
            throw new Error('API密钥未配置，请先配置API密钥');
        }
        
        // 确定API基础URL
        let apiUrl;
        if (apiBaseUrl) {
            apiUrl = apiBaseUrl;
        } else if (apiProvider === 'siliconflow') {
            apiUrl = 'https://api.siliconflow.cn/v1/chat/completions';
        } else if (apiProvider === 'openai') {
            apiUrl = 'https://api.openai.com/v1/chat/completions';
        } else {
            throw new Error('未知的API提供商');
        }
        
        console.log(`调用AI API: ${apiProvider}, 模型: ${selectedModel}, URL: ${apiUrl}, 操作: ${action}`);
        
        // 获取选择的写作风格
        const selectedStyle = style || writingStyleDropdown.value;
        
        // 根据不同的操作类型和风格构建系统提示
        let systemPrompt = '你是一名经过多年训练的专业写作助手，擅长根据不同的写作风格生成高质量的公众号内容。';
        
        if (action === 'generate') {
            // 根据选择的风格调整提示
            switch (selectedStyle) {
                case 'simple':
                    systemPrompt += `
# 自然风格写作设置
你是一名经过多年训练的写作助手，擅长用清晰、自然、诚实的语气写作。你的任务是根据下面的写作原则生成文本。

## 写作原则：
- 使用简单语言，句子简短，用词朴素
- 避免带有 AI 痕迹的表达，比如"深入探索""释放潜能""颠覆式"
- 表达直接简洁，删除多余的词
- 语气自然，像真人说话。可以用"而且""但是"开头
- 不要用营销语言，不要夸张
- 保持真实，不要装作热情或过度承诺
- 语法尽量简单，口语化是可以接受的
- 删除废话，避免多余形容词和填充词
- 注重清晰易懂，让读者轻松理解

## 限制规则（严格遵守）：
- 不使用破折号
- 不使用"不仅是 X 也是 Y"这种句式结构
- 除非原文有，否则不使用冒号
- 避免使用"你是否曾经想过"这种修辞性问题
- 不以"基本上""显然""有趣的是"等词开头或结尾
- 不使用"让我们看看""跟我一起""准备好了吗"这类假装互动的句子

## 最重要的是：
- 保持语气自然、真实，不要像机器人，也不要像推销员
- 如果原始输入模糊或不明确，请先向我提问
- 如果你需要澄清某些细节，也请先问我再开始写作`;
                    break;
                    
                case 'kazik':
                    systemPrompt += `
# 卡兹克风格写作设置
你是一名经过多年训练的写作助手，擅长用犀利、直接、有深度的卡兹克风格写作。你的任务是根据下面的写作原则生成文本。

## 写作原则：
- 观点鲜明，立场坚定，不模棱两可
- 语言犀利，直击问题本质，不绕弯子
- 批判性思维，敢于质疑常规观点
- 逻辑严密，论证有力，有深度分析
- 用词精准，避免模糊表达
- 可以适当使用反问和对比手法
- 保持独立思考，不随波逐流
- 注重实质内容，不追求表面华丽

## 限制规则（严格遵守）：
- 避免过度情绪化的表达
- 不使用无意义的修饰词
- 不使用"大家都认为""众所周知"这类假设性表达
- 避免空洞的口号式表达
- 不使用"绝对""完全"等极端词汇

## 最重要的是：
- 保持犀利、直接的风格，敢于表达不同观点
- 论证要有理有据，不只是批评
- 如果需要更多背景信息才能深入分析，请先向我提问`;
                    break;
                    
                case 'lively':
                    systemPrompt += `
# 活泼风格写作设置
你是一名经过多年训练的写作助手，擅长用活泼、生动、有趣的语言风格写作。你的任务是根据下面的写作原则生成文本。

## 写作原则：
- 语言生动活泼，富有感染力
- 可以适当使用网络流行语和表情符号（适度使用）
- 句式多变，避免单调重复
- 可以使用拟人、比喻等修辞手法
- 语气轻松愉快，积极向上
- 适当加入幽默元素，增加趣味性
- 与读者互动感强，有亲和力
- 节奏明快，不拖泥带水

## 限制规则（严格遵守）：
- 流行语使用要适度，不过度堆砌
- 表情符号使用要有节制，不影响内容表达
- 避免过度卖萌或装可爱的表达
- 不使用低俗或不雅的网络用语
- 幽默要有度，不冒犯他人

## 最重要的是：
- 保持活泼但不轻浮，有趣但不低俗
- 内容要有实质，不只是表面热闹
- 如果不确定某个流行语是否合适，请先向我确认`;
                    break;
                    
                case 'professional':
                    systemPrompt += `
# 专业风格写作设置
你是一名经过多年训练的写作助手，擅长用专业、严谨、权威的语言风格写作。你的任务是根据下面的写作原则生成文本。

## 写作原则：
- 用词准确，术语使用恰当
- 逻辑清晰，结构严谨
- 数据和事实引用要准确
- 客观中立，不带个人偏见
- 论证充分，有理有据
- 表达精确，避免模糊不清
- 专业术语使用要解释清楚
- 引用权威来源和研究成果

## 限制规则（严格遵守）：
- 不使用未经证实的数据或观点
- 避免过度绝对化的表述
- 不使用模糊不清的修饰词
- 避免主观臆断和猜测
- 不使用过于口语化的表达

## 最重要的是：
- 保持专业严谨的风格，同时确保内容易懂
- 平衡专业性和可读性
- 如果需要更多专业领域的准确信息，请先向我提问`;
                    break;
                    
                case 'humorous':
                    systemPrompt += `
# 幽默风格写作设置
你是一名经过多年训练的写作助手，擅长用幽默风趣的语言风格写作。你的任务是根据下面的写作原则生成文本。

## 写作原则：
- 语言幽默风趣，有智慧感
- 适当使用俏皮话和双关语
- 可以使用夸张手法，但要有度
- 善于自嘲和调侃，但不刻薄
- 节奏轻快，读起来轻松愉快
- 可以使用反讽和对比手法
- 注重幽默的时机和分寸
- 让读者在笑声中获取信息

## 限制规则（严格遵守）：
- 幽默要有底线，不冒犯他人
- 避免低俗、庸俗的笑话
- 不使用可能引起争议的敏感话题
- 不以牺牲内容质量为代价追求幽默
- 避免过度卖弄幽默感

## 最重要的是：
- 保持幽默但不失深度，有趣但不肤浅
- 幽默要服务于内容表达，不是为了搞笑而搞笑
- 如果不确定某个幽默点是否合适，请先向我确认`;
                    break;
                    
                default:
                    systemPrompt += '请根据用户的要求，生成适合公众号发布的文章内容。内容应该结构清晰、语言流畅、符合公众号的阅读习惯。';
            }
        } else if (action === 'rewrite') {
            systemPrompt += '请对提供的内容进行改写，保持原意不变，但优化表达方式，使内容更加流畅、有吸引力。';
            // 根据选择的风格调整改写提示
            switch (selectedStyle) {
                case 'simple':
                    systemPrompt += '改写为自然朴实风格：使用简单语言，句子简短，用词朴素，避免AI痕迹，表达直接简洁，语气自然像真人说话，不用营销语言，保持真实，语法简单口语化，删除废话和多余形容词，注重清晰易懂。不使用破折号，不使用"不仅是X也是Y"句式，除非原文有否则不使用冒号，避免"你是否曾经想过"这类修辞性问题，不以"基本上""显然""有趣的是"等词开头或结尾，不使用"让我们看看""跟我一起""准备好了吗"这类假装互动的句子。';
                    break;
                case 'kazik':
                    systemPrompt += '改写为卡兹克风格：观点鲜明，立场坚定，语言犀利直击本质，有批判性思维，逻辑严密论证有力，用词精准避免模糊，可以适当使用反问和对比，保持独立思考，注重实质内容。避免过度情绪化表达，不使用无意义修饰词，不使用"大家都认为""众所周知"这类假设性表达，避免空洞口号式表达，不使用"绝对""完全"等极端词汇。';
                    break;
                case 'lively':
                    systemPrompt += '改写为活泼风格：语言生动活泼富有感染力，可适度使用网络流行语和表情符号，句式多变避免单调，可使用拟人比喻等修辞，语气轻松愉快积极向上，适当加入幽默元素，与读者互动感强，节奏明快。流行语使用适度不过度堆砌，表情符号使用有节制不影响内容，避免过度卖萌或装可爱，不使用低俗不雅网络用语，幽默要有度不冒犯他人。';
                    break;
                case 'professional':
                    systemPrompt += '改写为专业风格：用词准确术语恰当，逻辑清晰结构严谨，数据和事实引用准确，客观中立不带偏见，论证充分有理有据，表达精确避免模糊，专业术语使用要解释清楚，引用权威来源和研究成果。不使用未经证实的数据或观点，避免过度绝对化表述，不使用模糊不清修饰词，避免主观臆断和猜测，不使用过于口语化表达。';
                    break;
                case 'humorous':
                    systemPrompt += '改写为幽默风格：语言幽默风趣有智慧感，适当使用俏皮话和双关语，可使用夸张手法但有度，善于自嘲和调侃但不刻薄，节奏轻快读起来轻松愉快，可使用反讽和对比手法，注重幽默时机和分寸，让读者在笑声中获取信息。幽默要有底线不冒犯他人，避免低俗庸俗笑话，不使用可能引起争议的敏感话题，不以牺牲内容质量为代价追求幽默，避免过度卖弄幽默感。';
                    break;
                default:
                    systemPrompt += '改写为更加流畅、有吸引力的风格。';
            }
        } else if (action === 'complete') {
            systemPrompt += '请根据提供的内容进行智能补全，保持原文风格和语调一致，使内容更加完整、丰富。';
        } else if (action === 'translate') {
            systemPrompt += '请将提供的中文内容准确翻译成英文，保持原意不变，确保翻译自然、流畅、符合英文表达习惯。';
        } else if (action === 'format') {
            systemPrompt += '请将提供的内容按照Markdown格式进行智能排版，确保包含适当的标题层级、段落分隔、列表结构等。保持原意不变，但使内容结构更加清晰、易读。';
        }
        
        // 将聊天历史转换为API期望的格式
        const apiMessages = [
            {
                role: 'system',
                content: systemPrompt
            }
        ];
        
        // 添加聊天历史，转换格式
        chatHistory.forEach(item => {
            if (item.sender === 'user') {
                apiMessages.push({
                    role: 'user',
                    content: item.message
                });
            } else if (item.sender === 'ai') {
                apiMessages.push({
                    role: 'assistant',
                    content: item.message
                });
            }
        });
        
        // 添加当前用户消息
        apiMessages.push({
            role: 'user',
            content: message
        });
        
        console.log('API消息格式:', JSON.stringify(apiMessages, null, 2));
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: selectedModel,
                messages: apiMessages,
                max_tokens: 2000,
                temperature: 0.7
            })
        });
        
        console.log(`AI API响应状态: ${response.status}`);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('AI API错误响应:', errorData);
            throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
        }
        
        const responseData = await response.json();
        console.log('AI API调用成功:', responseData);
        
        return responseData.choices[0].message.content;
    } catch (error) {
        console.error('AI调用失败:', error);
        throw error;
    }
}

// 生成格式化内容
async function generateFormattedContent() {
    const markdownContent = markdownEditor.value.trim();
    if (!markdownContent) {
        showNotification('请先输入或生成Markdown内容', 'warning');
        return;
    }
    
    if (!apiKey) {
        showApiKeyModal();
        return;
    }
    
    // 显示加载状态
    generateBtn.disabled = true;
    generateBtn.innerHTML = '<div class="loading-spinner"></div> 生成中...';
    
    try {
        const selectedStyle = styleDropdown.value;
        
        // 先检查内容是否已经是Markdown格式
        const isMarkdownFormat = checkMarkdownFormat(markdownContent);
        
        let finalHtml;
        if (isMarkdownFormat) {
            // 如果已经是Markdown格式，直接转换为HTML
            finalHtml = await convertMarkdownToHtml(markdownContent, selectedStyle);
        } else {
            // 如果不是Markdown格式，先转换为Markdown，再转换为HTML
            const markdownFormatted = await convertToMarkdown(markdownContent);
            // 更新编辑器内容为Markdown格式
            markdownEditor.value = markdownFormatted;
            // 然后转换为HTML
            finalHtml = await convertMarkdownToHtml(markdownFormatted, selectedStyle);
        }
        
        // 更新预览
        updatePreviewWithHtml(finalHtml);
        
        showNotification('排版生成成功！', 'success');
    } catch (error) {
        console.error('生成排版失败:', error);
        showNotification('生成排版失败，请重试', 'error');
    } finally {
        // 恢复按钮状态
        generateBtn.disabled = false;
        generateBtn.innerHTML = '<i class="fas fa-magic mr-1"></i> 生成排版';
    }
}

// 检查内容是否已经是Markdown格式
function checkMarkdownFormat(content) {
    // 检查是否包含Markdown标题标记
    const hasHeaders = /^#{1,6}\s+/m.test(content);
    // 检查是否包含Markdown列表标记
    const hasLists = /^[\-\*\+]\s+/m.test(content) || /^\d+\.\s+/m.test(content);
    // 检查是否包含Markdown引用标记
    const hasQuotes = /^>\s+/m.test(content);
    // 检查是否包含Markdown代码块标记
    const hasCodeBlocks = /```[\s\S]*```/.test(content) || /`[^`]+`/.test(content);
    // 检查是否包含Markdown链接标记
    const hasLinks = /\[([^\]]+)\]\(([^)]+)\)/.test(content);
    // 检查是否包含Markdown加粗/斜体标记
    const hasEmphasis = /\*\*[^*]+\*\*/.test(content) || /\*[^*]+\*/.test(content) || /__[^_]+__/.test(content) || /_[^_]+_/.test(content);
    
    return hasHeaders || hasLists || hasQuotes || hasCodeBlocks || hasLinks || hasEmphasis;
}

// 将普通文本转换为Markdown格式
async function convertToMarkdown(text) {
    try {
        // 确定API基础URL
        let apiUrl;
        if (apiBaseUrl) {
            apiUrl = apiBaseUrl;
        } else if (apiProvider === 'siliconflow') {
            apiUrl = 'https://api.siliconflow.cn/v1/chat/completions';
        } else if (apiProvider === 'openai') {
            apiUrl = 'https://api.openai.com/v1/chat/completions';
        } else {
            throw new Error('未知的API提供商');
        }
        
        const systemPrompt = '你是一个专业的文本格式化助手，请将提供的普通文本转换为结构化的Markdown格式。请确保：1. 添加适当的标题层级（# ## ###）；2. 将长段落拆分为易于阅读的短段落；3. 识别并格式化列表项；4. 保持原文的核心内容和含义不变；5. 确保转换后的Markdown格式正确且易于阅读。';
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: selectedModel,
                messages: [
                    {
                        role: 'system',
                        content: systemPrompt
                    },
                    {
                        role: 'user',
                        content: `请将以下文本转换为Markdown格式：\n\n${text}`
                    }
                ],
                max_tokens: 4000,
                temperature: 0.3
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        console.error('转换为Markdown格式出错:', error);
        throw error;
    }
}

// 将Markdown转换为HTML
async function convertMarkdownToHtml(markdown, style) {
    try {
        // 确定API基础URL
        let apiUrl;
        if (apiBaseUrl) {
            apiUrl = apiBaseUrl;
        } else if (apiProvider === 'siliconflow') {
            apiUrl = 'https://api.siliconflow.cn/v1/chat/completions';
        } else if (apiProvider === 'openai') {
            apiUrl = 'https://api.openai.com/v1/chat/completions';
        } else {
            throw new Error('未知的API提供商');
        }
        
        // 根据风格设置系统提示
        let systemPrompt = '你是一个专业的Markdown到HTML转换器，请将以下Markdown内容转换为适合公众号发布的HTML格式。';
        
        if (style === 'ai-tech') {
            systemPrompt += `请使用以下HTML格式要求：
1. 使用现代化的设计风格，适合AI科技类内容
2. 标题使用深蓝色(#1a365d)，字体加粗
3. 正文使用深灰色(#333333)，行间距1.6
4. 代码块使用浅灰色背景(#f5f5f5)，字体使用等宽字体
5. 引用使用浅蓝色背景(#e6f7ff)，左边框使用蓝色(#1890ff)
6. 列表使用适当的图标和间距
7. 整体布局清晰，重点突出`;
        } else if (style === 'minimalist') {
            systemPrompt += `请使用以下HTML格式要求：
1. 使用极简主义设计风格
2. 标题使用黑色(#000000)，字体简洁
3. 正文使用深灰色(#444444)，行间距1.8
4. 代码块使用白色背景(#ffffff)，灰色边框
5. 引用使用浅灰色背景(#f9f9f9)，左边框使用深灰色(#cccccc)
6. 列表使用简洁的符号
7. 整体设计简洁大方，留白充足`;
        } else if (style === 'business') {
            systemPrompt += `请使用以下HTML格式要求：
1. 使用商务专业的设计风格
2. 标题使用深蓝色(#003366)，字体正式
3. 正文使用深灰色(#333333)，行间距1.6
4. 代码块使用浅灰色背景(#f8f8f8)，专业边框
5. 引用使用浅黄色背景(#fffef0)，左边框使用金色(#d4af37)
6. 列表使用专业的编号和样式
7. 整体设计专业稳重，适合商务内容`;
        }
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: selectedModel,
                messages: [
                    {
                        role: 'system',
                        content: systemPrompt
                    },
                    {
                        role: 'user',
                        content: `请将以下Markdown内容转换为HTML：\n\n${markdown}`
                    }
                ],
                max_tokens: 4000,
                temperature: 0.3
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        console.error('Markdown转换出错:', error);
        throw error;
    }
}

// 简单的Markdown到HTML转换（仅用于预览）
function convertMarkdownToSimpleHtml(markdown) {
    let html = markdown;
    
    // 转换标题
    html = html.replace(/^### (.*$)/gim, '<h3 style="font-size: 16px; font-weight: bold; margin: 15px 0;">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 style="font-size: 18px; font-weight: bold; margin: 20px 0;">$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1 style="font-size: 20px; font-weight: bold; margin: 25px 0;">$1</h1>');
    
    // 转换引用
    html = html.replace(/^> (.*$)/gim, '<blockquote style="border-left: 4px solid #3B82F6; padding-left: 15px; margin: 15px 0; color: #64748B;">$1</blockquote>');
    
    // 转换列表
    html = html.replace(/^\- (.*$)/gim, '<li style="margin: 5px 0;">$1</li>');
    html = html.replace(/^\d+\. (.*$)/gim, '<li style="margin: 5px 0;">$1</li>');
    
    // 转换段落
    html = html.replace(/\n\n/g, '</p><p style="margin: 15px 0; line-height: 1.7;">');
    html = '<p style="margin: 15px 0; line-height: 1.7;">' + html + '</p>';
    
    // 包装在容器中
    return `<div style="max-width: 680px; margin: 0 auto; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;">${html}</div>`;
}

// 使用HTML内容更新预览
function updatePreviewWithHtml(htmlContent) {
    const fullHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>预览</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5;">
    ${htmlContent}
</body>
</html>`;
    
    previewFrame.srcdoc = fullHtml;
}

// 复制Markdown内容
function copyMarkdown() {
    const content = markdownEditor.value.trim();
    if (!content) {
        showNotification('没有可复制的Markdown内容', 'warning');
        return;
    }
    
    copyToClipboard(content);
    showNotification('Markdown内容已复制到剪贴板', 'success');
}

// 复制HTML内容（仅HTML代码）
function copyHtmlCode() {
    // 获取预览框架中的HTML内容
    const htmlContent = previewFrame.srcdoc;
    if (!htmlContent || htmlContent.includes('请先输入或生成Markdown内容')) {
        showNotification('没有可复制的HTML内容，请先生成排版', 'warning');
        return;
    }

    // 提取body内的内容
    const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const contentToCopy = bodyMatch ? bodyMatch[1] : htmlContent;

    copyToClipboard(contentToCopy);
    showNotification('HTML代码已复制到剪贴板', 'success');
}

// 保持copyHtml作为兼容性的别名
function copyHtml() {
    copyHtmlCode();
}

// 复制富文本内容（保持格式）
function copyRichText() {
    const htmlContent = previewFrame.srcdoc;
    if (!htmlContent || htmlContent.includes('请先输入或生成Markdown内容')) {
        showNotification('没有可复制的富文本内容，请先生成排版', 'warning');
        return;
    }

    try {
        // 创建一个新的div元素来包含HTML内容
        const tempDiv = document.createElement('div');
        tempDiv.style.position = 'absolute';
        tempDiv.style.left = '-9999px';
        tempDiv.style.top = '-9999px';

        // 使用iframe中的完整HTML内容
        const iframeContent = previewFrame.contentDocument || previewFrame.contentWindow.document;
        const bodyContent = iframeContent.body.innerHTML;

        // 如果body内有内容，使用它，否则使用整个文档
        const finalContent = bodyContent || htmlContent;

        tempDiv.innerHTML = finalContent;
        document.body.appendChild(tempDiv);

        // 选择富文本内容
        const range = document.createRange();
        range.selectNodeContents(tempDiv);

        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);

        // 执行复制命令
        const successful = document.execCommand('copy');

        // 清理
        document.body.removeChild(tempDiv);
        selection.removeAllRanges();

        if (successful) {
            showNotification('✅ 富文本内容已复制到剪贴板，可直接粘贴到公众号编辑器', 'success');
        } else {
            // 降级使用现代Clipboard API
            copyRichTextWithClipboardAPI(finalContent);
        }
    } catch (error) {
        console.error('富文本复制失败:', error);
        // 降级使用现代Clipboard API
        copyRichTextWithClipboardAPI(htmlContent);
    }
}

// 使用Clipboard API复制富文本
async function copyRichTextWithClipboardAPI(content) {
    try {
        // 创建包含样式的完整HTML
        const styledContent = `
            <div style="max-width: 680px; margin: 0 auto; padding: 20px;
                 font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue',
                 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
                 line-height: 1.7; color: #333;">
                ${content}
            </div>
        `;

        // 创建Blob对象
        const blob = new Blob([styledContent], { type: 'text/html' });

        // 尝试使用现代的Clipboard API
        if (navigator.clipboard && window.ClipboardItem) {
            const clipboardItem = new ClipboardItem({ 'text/html': blob });
            await navigator.clipboard.write([clipboardItem]);
            showNotification('✅ 富文本内容已复制到剪贴板，可直接粘贴到公众号编辑器', 'success');
        } else {
            // 降级到纯文本复制
            copyToClipboard(styledContent.replace(/<[^>]*>/g, ''));
            showNotification('⚠️ 已复制为纯文本，部分格式可能丢失', 'warning');
        }
    } catch (clipboardError) {
        console.error('Clipboard API 复制失败:', clipboardError);
        // 最后降级到纯文本复制
        copyToClipboard(content.replace(/<[^>]*>/g, ''));
        showNotification('⚠️ 已复制为纯文本，部分格式可能丢失', 'warning');
    }
}

// 复制到剪贴板
function copyToClipboard(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
}

// 清空对话
function clearChat() {
    if (confirm('确定要清空所有对话记录吗？')) {
        chatHistory = [];
        chatMessages.innerHTML = `
            <div class="message ai">
                <div class="message-bubble">
                    你好，我是你的专属公众号爆款内容架构师AI助手。我的核心使命是帮助你高效产出爆款文章。
                    
                    【第1步：痛点锁定】
                    一篇爆款的起点，不是文采，而是精准的"痛点"。
                    
                    请告诉我：
                    1. 目标读者：比如，是30-40岁的焦虑宝妈？还是刚入职场的00后？
                    2. 核心焦虑：他们深夜睡不着时，脑子里在循环的那个具体问题是什么？
                </div>
                <div class="message-meta">爆款内容架构师 · 刚刚</div>
            </div>
        `;
        markdownEditor.value = '';
        updatePreview();
        showNotification('对话已清空', 'success');
    }
}

// 显示通知
function showNotification(message, type) {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 px-4 py-2 rounded-lg shadow-lg z-50 transform transition-all duration-300 translate-x-full`;
    
    // 根据类型设置样式
    switch (type) {
        case 'success':
            notification.classList.add('bg-green-500', 'text-white');
            break;
        case 'error':
            notification.classList.add('bg-red-500', 'text-white');
            break;
        case 'warning':
            notification.classList.add('bg-yellow-500', 'text-white');
            break;
        default:
            notification.classList.add('bg-gray-500', 'text-white');
    }
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // 显示动画
    setTimeout(() => {
        notification.classList.remove('translate-x-full');
    }, 10);
    
    // 自动隐藏
    setTimeout(() => {
        notification.classList.add('translate-x-full');
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// 更新预览（基于Markdown内容）
function updatePreview() {
    const markdownContent = markdownEditor.value.trim();
    if (!markdownContent) {
        previewFrame.srcdoc = '<div style="padding: 20px; color: #64748B; text-align: center;">请先输入或生成Markdown内容</div>';
        return;
    }
    
    // 使用简单的Markdown到HTML转换进行预览
    const simpleHtml = convertMarkdownToSimpleHtml(markdownContent);
    updatePreviewWithHtml(simpleHtml);
}

// 显示消息（替代showNotification函数）
function showMessage(message, type) {
    showNotification(message, type);
}

// 确认Markdown内容
async function confirmMarkdown() {
    const content = markdownEditor.value.trim();
    if (!content) {
        showNotification('请先添加内容到编辑器', 'warning');
        return;
    }
    
    // 显示加载状态
    confirmMarkdownBtn.disabled = true;
    confirmMarkdownBtn.innerHTML = '<div class="loading-spinner"></div>';
    
    try {
        // 将内容转换为标准Markdown格式
        const markdownContent = convertToStandardMarkdown(content);
        
        // 更新编辑器内容为标准Markdown格式
        markdownEditor.value = markdownContent;
        updatePreview();
        
        showNotification('内容已转换为标准Markdown格式', 'success');
    } catch (error) {
        console.error('转换Markdown格式失败:', error);
        showNotification('转换失败，请重试', 'error');
    } finally {
        // 恢复按钮状态
        confirmMarkdownBtn.disabled = false;
        confirmMarkdownBtn.innerHTML = '确认内容';
    }
}

// 将内容转换为标准Markdown格式
function convertToStandardMarkdown(content) {
    let markdownContent = content;
    
    // 1. 处理标题格式
    markdownContent = markdownContent.replace(/^(#{1,6})\s*(.+)$/gm, (match, hashes, text) => {
        // 确保标题格式正确：# 标题文本
        return `${hashes} ${text.trim()}`;
    });
    
    // 2. 处理列表
    // 有序列表
    markdownContent = markdownContent.replace(/^(\d+)\.\s+(.+)$/gm, (match, num, text) => {
        return `${num}. ${text.trim()}`;
    });
    
    // 无序列表
    markdownContent = markdownContent.replace(/^[-*+]\s+(.+)$/gm, (match, text) => {
        return `- ${text.trim()}`;
    });
    
    // 3. 处理引用
    markdownContent = markdownContent.replace(/^>\s*(.+)$/gm, (match, text) => {
        return `> ${text.trim()}`;
    });
    
    // 4. 处理代码块
    // 行内代码
    markdownContent = markdownContent.replace(/`([^`]+)`/g, '`$1`');
    
    // 5. 处理链接
    markdownContent = markdownContent.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '[$1]($2)');
    
    // 6. 处理图片
    markdownContent = markdownContent.replace(/!\[([^\]]*)\]\(([^\)]+)\)/g, '![$1]($2)');
    
    // 7. 处理粗体和斜体
    markdownContent = markdownContent.replace(/\*\*(.+?)\*\*/g, '**$1**');
    markdownContent = markdownContent.replace(/\*(.+?)\*/g, '*$1*');
    markdownContent = markdownContent.replace(/_(.+?)_/g, '_$1_');
    
    // 8. 处理换行和段落
    // 确保段落之间有适当的空行
    markdownContent = markdownContent.replace(/\n{3,}/g, '\n\n');
    
    // 9. 处理表格（基础支持）
    markdownContent = markdownContent.replace(/\|(.+)\|/g, (match, content) => {
        const cells = content.split('|').map(cell => cell.trim());
        return `| ${cells.join(' | ')} |`;
    });
    
    // 10. 确保以换行符结尾
    if (!markdownContent.endsWith('\n')) {
        markdownContent += '\n';
    }
    
    return markdownContent;
}

// 改写内容
async function rewriteContent() {
    const content = markdownEditor.value.trim() || chatInput.value.trim();
    if (!content) {
        showNotification('请先输入内容或生成文章', 'warning');
        return;
    }
    
    if (!apiKey) {
        showApiKeyModal();
        return;
    }
    
    // 显示加载状态
    rewriteBtn.disabled = true;
    rewriteBtn.innerHTML = '<div class="loading-spinner"></div>';
    
    try {
        // 调用AI API进行改写
        const response = await callAI(content, 'rewrite');
        
        // 更新编辑器内容
        markdownEditor.value = response;
        updatePreview();
        
        showNotification('内容已改写', 'success');
    } catch (error) {
        console.error('改写失败:', error);
        showNotification('改写失败，请重试', 'error');
    } finally {
        // 恢复按钮状态
        rewriteBtn.disabled = false;
        rewriteBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
    }
}

// 翻译内容
async function translateContent() {
    const content = markdownEditor.value.trim() || chatInput.value.trim();
    if (!content) {
        showNotification('请先输入内容或生成文章', 'warning');
        return;
    }
    
    if (!apiKey) {
        showApiKeyModal();
        return;
    }
    
    // 显示加载状态
    translateBtn.disabled = true;
    translateBtn.innerHTML = '<div class="loading-spinner"></div>';
    
    try {
        // 调用AI API进行翻译
        const response = await callAI(content, 'translate');
        
        // 更新编辑器内容
        markdownEditor.value = response;
        updatePreview();
        
        showNotification('内容已翻译成英文', 'success');
    } catch (error) {
        console.error('翻译失败:', error);
        showNotification('翻译失败，请重试', 'error');
    } finally {
        // 恢复按钮状态
        translateBtn.disabled = false;
        translateBtn.innerHTML = '<i class="fas fa-language"></i>';
    }
}

// 编辑选中的内容
async function editSelectedContent() {
    // 获取预览iframe中的选中内容
    const selectedText = getSelectedTextFromPreview();
    
    if (!selectedText) {
        showNotification('请先在预览区域选择要编辑的内容', 'warning');
        return;
    }
    
    if (!apiKey) {
        showApiKeyModal();
        return;
    }
    
    // 显示编辑模态框
    showEditModal(selectedText);
}

// 获取预览区域中的选中文本
function getSelectedTextFromPreview() {
    try {
        // 获取iframe的文档对象
        const iframeDoc = previewFrame.contentDocument || previewFrame.contentWindow.document;
        
        // 获取选中的文本
        const selection = iframeDoc.getSelection();
        return selection.toString().trim();
    } catch (error) {
        console.error('获取选中文本失败:', error);
        return null;
    }
}

// 显示编辑模态框
function showEditModal(selectedText) {
    // 创建模态框HTML
    const modalHtml = `
        <div id="editModal" class="modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>编辑选中内容</h3>
                    <button id="closeEditModal" class="close-btn">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="edit-section">
                        <label for="originalText">原始内容:</label>
                        <textarea id="originalText" readonly>${selectedText}</textarea>
                    </div>
                    <div class="edit-section">
                        <label for="editInstruction">编辑指令:</label>
                        <textarea id="editInstruction" placeholder="请输入编辑指令，例如：使这段话更简洁、增加更多细节、改为专业风格等"></textarea>
                    </div>
                    <div class="edit-section">
                        <label for="editedText">编辑后内容:</label>
                        <textarea id="editedText" readonly></textarea>
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="applyEditBtn" class="btn-primary">应用编辑</button>
                    <button id="cancelEditBtn" class="btn-secondary">取消</button>
                </div>
            </div>
        </div>
    `;
    
    // 添加模态框到页面
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // 获取模态框元素
    const editModal = document.getElementById('editModal');
    const closeEditModal = document.getElementById('closeEditModal');
    const editInstruction = document.getElementById('editInstruction');
    const editedText = document.getElementById('editedText');
    const applyEditBtn = document.getElementById('applyEditBtn');
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    
    // 关闭模态框事件
    closeEditModal.addEventListener('click', () => {
        document.body.removeChild(editModal);
    });
    
    cancelEditBtn.addEventListener('click', () => {
        document.body.removeChild(editModal);
    });
    
    // 应用编辑事件
    applyEditBtn.addEventListener('click', async () => {
        const instruction = editInstruction.value.trim();
        if (!instruction) {
            showNotification('请输入编辑指令', 'warning');
            return;
        }
        
        // 显示加载状态
        applyEditBtn.disabled = true;
        applyEditBtn.innerHTML = '<div class="loading-spinner"></div>';
        
        try {
            // 调用AI API进行编辑
            const prompt = `请根据以下指令编辑这段内容：\n\n原始内容：${selectedText}\n\n编辑指令：${instruction}\n\n请只返回编辑后的内容，不要添加任何解释。`;
            const response = await callAI(prompt, 'edit');
            
            // 显示编辑后的内容
            editedText.value = response;
            applyEditBtn.disabled = false;
            applyEditBtn.innerHTML = '应用编辑';
            
            // 保存原始文本和编辑后的文本，以便后续应用
            editedText.dataset.originalText = selectedText;
            editedText.dataset.editedText = response;
        } catch (error) {
            console.error('编辑失败:', error);
            showNotification('编辑失败，请重试', 'error');
            applyEditBtn.disabled = false;
            applyEditBtn.innerHTML = '应用编辑';
        }
    });
    
    // 显示模态框
    editModal.style.display = 'block';
    
    // 应用编辑按钮的最终点击事件（在编辑完成后）
    applyEditBtn.addEventListener('click', () => {
        if (editedText.dataset.editedText) {
            // 替换Markdown编辑器中的原始文本
            const currentMarkdown = markdownEditor.value;
            const updatedMarkdown = currentMarkdown.replace(
                editedText.dataset.originalText, 
                editedText.dataset.editedText
            );
            
            markdownEditor.value = updatedMarkdown;
            updatePreview();
            
            // 关闭模态框
            document.body.removeChild(editModal);
            
            showNotification('已应用编辑', 'success');
        }
    });
}