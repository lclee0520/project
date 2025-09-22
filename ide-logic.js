document.addEventListener('DOMContentLoaded', () => {
    // Monaco Editor 라이브러리 경로 설정
    require.config({ paths: { 'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' }});

    let editor; // 에디터 인스턴스
    let selectedItem = null; // 사용자가 선택한 파일/폴더 정보

    // 파일 시스템 객체
    const fileSystem = {
        'root': {
            type: 'folder',
            children: {
                'project': {
                    type: 'folder',
                    children: {
                        'index.html': { type: 'file', content: `<!DOCTYPE html>\n<html>\n<head>\n    <title>IDE Preview</title>\n    <link rel="stylesheet" href="style.css">\n</head>\n<body>\n    <h1>Welcome to your Web IDE!</h1>\n    <p>You can edit this in index.html</p>\n    <script src="script.js"><\/script>\n</body>\n</html>` },
                        'script.js': { type: 'file', content: 'console.log("Hello from script.js!");\n\n// Try changing the h1 text content!\ndocument.querySelector("h1").addEventListener("click", () => {\n    alert("You clicked the title!");\n});' },
                        'style.css': { type: 'file', content: 'body {\n  background-color: #2c3e50;\n  color: white;\n  font-family: sans-serif;\n  text-align: center;\n  padding-top: 50px;\n}' }
                    }
                }
            }
        }
    };

    // --- HTML 요소 가져오기 ---
    const fileExplorerList = document.getElementById('file-explorer-list');
    const newFileButton = document.getElementById('new-file-button');
    const newFolderButton = document.getElementById('new-folder-button');
    const deleteButton = document.getElementById('delete-button');
    const runButton = document.getElementById('run-button');
    const resizer = document.getElementById('resizer');
    const editorWrapper = document.getElementById('editor-wrapper');
    const terminalContainer = document.getElementById('terminal-container');
    const terminalInput = document.getElementById('terminal-input');
    const terminalOutput = document.getElementById('output');

    // --- 에디터 초기화 ---
    require(['vs/editor/editor.main'], function() {
        editor = monaco.editor.create(document.getElementById('editor-container'), {
            value: `// 왼쪽 탐색기에서 파일을 선택해주세요.`,
            language: 'javascript',
            theme: 'vs-dark',
            automaticLayout: true
        });
    });

    // --- 파일 탐색기 렌더링 ---
    function renderFileExplorer() {
        fileExplorerList.innerHTML = '';
        createFileTree(fileSystem.root, 'root');
        
        const initialFile = document.querySelector('[data-path="root/project/example.html"]');
        if(initialFile) {
            initialFile.click();
            const projectFolderDiv = document.querySelector('[data-path="root/project"]');
            if(projectFolderDiv) {
                const subUl = projectFolderDiv.closest('li').querySelector('ul');
                if(subUl) subUl.style.display = 'block';
            }
        }
    }

    function createFileTree(node, path) {
        if (!node.children) return;

        Object.entries(node.children).sort(([a], [b]) => a.localeCompare(b)).forEach(([name, data]) => {
            const li = document.createElement('li');
            const itemDiv = document.createElement('div');
            const currentPath = `${path}/${name}`;
            itemDiv.className = 'flex items-center cursor-pointer hover:bg-opacity-20 hover:bg-white rounded p-1 transition-colors';
            itemDiv.dataset.path = currentPath;
            
            const icon = document.createElement('span');
            icon.className = 'mr-2 flex-shrink-0 w-5';
            const nameSpan = document.createElement('span');
            nameSpan.textContent = name;
            nameSpan.className = 'truncate';

            itemDiv.append(icon, nameSpan);
            li.appendChild(itemDiv);

            // ==========================================================
            // ✨ 여기가 수정된 핵심 로직입니다! (파일 열기 및 저장 순서 변경)
            // ==========================================================
            itemDiv.addEventListener('click', (e) => {
                e.stopPropagation();
                
                // 1. 다른 파일로 바꾸기 전에, 현재 열려있던 파일의 내용을 먼저 저장합니다.
                saveCurrentFile();

                // 2. 이전에 선택됐던 항목의 'selected' 스타일을 제거합니다.
                const currentSelected = document.querySelector('.selected');
                if(currentSelected) currentSelected.classList.remove('selected');
                
                // 3. 새로 클릭한 항목을 'selected'로 만들고, 전역 변수에 정보를 업데이트합니다.
                itemDiv.classList.add('selected');
                selectedItem = {
                    element: itemDiv,
                    name: name,
                    path: currentPath,
                    parentPath: path,
                    type: data.type
                };

                // 4. 이제 안심하고 새 파일을 엽니다.
                if (data.type === 'file') {
                    openFile(data);
                } else if (data.type === 'folder') {
                    const subUl = li.querySelector('ul');
                    if(subUl) {
                        subUl.style.display = subUl.style.display === 'none' ? 'block' : 'none';
                    }
                }
            });

            if (data.type === 'folder') {
                icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>`;
                const subUl = document.createElement('ul');
                subUl.style.display = 'none';
                subUl.className = 'pl-5 space-y-1 mt-1';
                li.appendChild(subUl);
                
                if (data.children) {
                    createFileTree(data, currentPath, subUl);
                }
            } else {
                icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>`;
            }
            
            const parentElement = li.closest('ul');
            parentElement.appendChild(li);
        });
    }

    // 파일 트리 생성 함수 오버로드 (초기 호출을 위함)
    function createFileTree(node, path, parentElement = fileExplorerList) {
        if (!node.children) return;

        Object.entries(node.children).sort(([a], [b]) => a.localeCompare(b)).forEach(([name, data]) => {
            const li = document.createElement('li');
            const itemDiv = document.createElement('div');
            const currentPath = `${path}/${name}`;
            itemDiv.className = 'flex items-center cursor-pointer hover:bg-opacity-20 hover:bg-white rounded p-1 transition-colors';
            itemDiv.dataset.path = currentPath;
            
            const icon = document.createElement('span');
            icon.className = 'mr-2 flex-shrink-0 w-5';
            const nameSpan = document.createElement('span');
            nameSpan.textContent = name;
            nameSpan.className = 'truncate';

            itemDiv.append(icon, nameSpan);
            li.appendChild(itemDiv);

            itemDiv.addEventListener('click', (e) => {
                e.stopPropagation();
                saveCurrentFile();
                
                const currentSelected = document.querySelector('.selected');
                if(currentSelected) currentSelected.classList.remove('selected');
                
                itemDiv.classList.add('selected');
                selectedItem = {
                    element: itemDiv,
                    name: name,
                    path: currentPath,
                    parentPath: path,
                    type: data.type
                };

                if (data.type === 'file') {
                    openFile(data);
                } else if (data.type === 'folder') {
                    const subUl = li.querySelector('ul');
                    if(subUl) {
                        subUl.style.display = subUl.style.display === 'none' ? 'block' : 'none';
                    }
                }
            });

            if (data.type === 'folder') {
                icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>`;
                const subUl = document.createElement('ul');
                subUl.style.display = 'none';
                subUl.className = 'pl-5 space-y-1 mt-1';
                li.appendChild(subUl);
                
                if (data.children) {
                    createFileTree(data, currentPath, subUl);
                }
            } else {
                icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>`;
            }
            parentElement.appendChild(li);
        });
    }

    
    function findNodeByPath(path) {
        const parts = path.split('/').filter(p => p && p !== 'root');
        let current = fileSystem.root;
        for (const part of parts) {
            if (current && current.children && current.children[part]) {
                current = current.children[part];
            } else {
                return null;
            }
        }
        return current;
    }

    // --- 파일 열기 및 저장 (로직 분리) ---
    function openFile(data) {
        editor.setValue(data.content);
        const extension = selectedItem.name.split('.').pop();
        const languages = { 'html': 'html', 'js': 'javascript', 'css': 'css' };
        monaco.editor.setModelLanguage(editor.getModel(), languages[extension] || 'plaintext');
        document.getElementById('editor-tab-name').textContent = selectedItem.name;
    }
    
    function saveCurrentFile() {
        if (!selectedItem || selectedItem.type !== 'file' || !editor) return;
        const node = findNodeByPath(selectedItem.path);
        if (node) {
            node.content = editor.getValue();
        }
    }

    // --- 파일/폴더 생성 및 삭제 ---
    function createItem(type) {
        const name = prompt(`새 ${type === 'file' ? '파일' : '폴더'} 이름을 입력하세요:`);
        if (!name || !/^[a-zA-Z0-9._-]+$/.test(name)) {
            if(name) showNotification("유효하지 않은 이름입니다.", 'error');
            return;
        }

        let parentPath = 'root';
        if (selectedItem) {
            parentPath = selectedItem.type === 'folder' ? selectedItem.path : selectedItem.parentPath;
        }
        
        const parentNode = findNodeByPath(parentPath);
        if (!parentNode || parentNode.type !== 'folder') {
            showNotification("폴더를 선택해야 합니다.", 'error');
            return;
        }

        if (parentNode.children[name]) {
            showNotification("이미 존재하는 이름입니다.", 'error');
            return;
        }

        parentNode.children[name] = type === 'file' 
            ? { type: 'file', content: '' }
            : { type: 'folder', children: {} };
        renderFileExplorer();
    }
    
    function deleteSelectedItem() {
        if (!selectedItem) {
            showNotification("삭제할 항목을 선택하세요.", 'error');
            return;
        }
        if (selectedItem.path === 'root/project') {
             showNotification("최상위 프로젝트 폴더는 삭제할 수 없습니다.", 'error');
            return;
        }

        const parentNode = findNodeByPath(selectedItem.parentPath);
        if (parentNode && parentNode.children) {
            const currentFileName = document.getElementById('editor-tab-name').textContent;
            if (selectedItem.name === currentFileName) {
                editor.setValue('// 파일이 삭제되었습니다.');
                document.getElementById('editor-tab-name').textContent = '';
            }

            delete parentNode.children[selectedItem.name];
            selectedItem = null;
            renderFileExplorer();
            showNotification('삭제되었습니다.');
        }
    }

    // --- 이벤트 리스너 등록 ---
    newFileButton.addEventListener('click', () => createItem('file'));
    newFolderButton.addEventListener('click', () => createItem('folder'));
    deleteButton.addEventListener('click', deleteSelectedItem);

    // --- 크기 조절 로직 ---
    let isResizing = false;
    resizer.addEventListener('mousedown', () => {
        isResizing = true;
        document.body.style.cursor = 'row-resize';
        document.body.style.userSelect = 'none';
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', stopResizing);
    });

    function handleMouseMove(e) {
        if (!isResizing) return;
        const totalHeight = editorWrapper.parentElement.clientHeight;
        const newEditorHeight = e.clientY - editorWrapper.getBoundingClientRect().top;
        if (newEditorHeight > 50 && totalHeight - newEditorHeight > 50) {
            const newEditorHeightPercent = (newEditorHeight / totalHeight) * 100;
            editorWrapper.style.height = `${newEditorHeightPercent}%`;
            terminalContainer.style.height = `${100 - newEditorHeightPercent}%`;
            if (editor) editor.layout();
        }
    }

    function stopResizing() {
        isResizing = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', stopResizing);
    }
    
    // --- 코드 실행 로직 ---
    runButton.addEventListener('click', () => {
        saveCurrentFile(); 
        
        const htmlNode = findNodeByPath('root/project/index.html');
        const cssNode = findNodeByPath('root/project/style.css');
        const jsNode = findNodeByPath('root/project/script.js');

        if (!htmlNode) {
            showNotification("index.html 파일이 필요합니다.", "error");
            return;
        }
        
        // 이전 iframe이 있다면 제거하고 로그 추가
        const oldIframe = terminalOutput.querySelector('iframe');
        if(oldIframe) {
            terminalOutput.innerHTML = ''; // 터미널 클리어
        }
        const logEntry = document.createElement('p');
        logEntry.textContent = `> Running project...`;
        terminalOutput.appendChild(logEntry);
        
        const iframe = document.createElement('iframe');
        iframe.style.width = '100%';
        iframe.style.height = 'calc(100% - 30px)';
        iframe.style.border = '1px solid #414868';
        iframe.style.backgroundColor = 'white';
        
        const htmlContent = htmlNode.content.replace(/<script.*src="script.js".*><\/script>/, '');

        const srcDoc = `
            <html>
                <head>
                    ${cssNode ? `<style>${cssNode.content}</style>` : ''}
                </head>
                <body>
                    ${htmlContent}
                    ${jsNode ? `<script>${jsNode.content}<\/script>` : ''}
                </body>
            </html>
        `;
        iframe.srcdoc = srcDoc;

        terminalOutput.appendChild(iframe);
        terminalOutput.scrollTop = terminalOutput.scrollHeight;
    });

    // --- 대화형 터미널 로직 ---
    terminalInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && terminalInput.value) {
            const command = terminalInput.value;
            
            const promptLine = document.createElement('div');
            promptLine.innerHTML = `<span class="text-green-400 mr-2">$</span><span>${command}</span>`;
            terminalOutput.appendChild(promptLine);

            processCommand(command);

            terminalInput.value = '';
            terminalOutput.scrollTop = terminalOutput.scrollHeight;
        }
    });

    async function processCommand(command) {
        const outputLine = document.createElement('div');
        const cmd = command.trim().split(' ')[0].toLowerCase();

        if (cmd === 'clear') {
            terminalOutput.innerHTML = '';
            return;
        }
        if (cmd === 'help') {
            outputLine.innerHTML = `<pre>Available local commands: help, clear.\nOther commands are sent to the backend server.</pre>`;
            terminalOutput.appendChild(outputLine);
            terminalOutput.scrollTop = terminalOutput.scrollHeight;
            return;
        }

        try {
            const response = await fetch('http://localhost:3000/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: command })
            });

            if (!response.ok) {
                 throw new Error(`Server responded with status: ${response.status}`);
            }

            const data = await response.json();
            outputLine.innerHTML = `<pre class="whitespace-pre-wrap">${data.output || ''}</pre>`;

        } catch (error) {
            console.error('Fetch error:', error);
            outputLine.innerHTML = `<pre class="text-red-400">Error: Could not connect to backend server.\nIs 'node server.js' running?</pre>`;
        }
        
        terminalOutput.appendChild(outputLine);
        terminalOutput.scrollTop = terminalOutput.scrollHeight;
    }

    function showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.classList.remove('bg-blue-500', 'bg-red-500');
        notification.classList.add(type === 'error' ? 'bg-red-500' : 'bg-blue-500');
        notification.classList.remove('hidden');
        setTimeout(() => notification.classList.add('hidden'), 3000);
    }
    
    renderFileExplorer();
});

