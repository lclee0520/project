document.addEventListener('DOMContentLoaded', () => {
    // Monaco Editor 라이브러리 경로 설정
    require.config({ paths: { 'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' }});

    let editor; // 에디터 인스턴스
    let selectedItem = null; // 사용자가 선택한 파일/폴더 정보

    // 파일 시스템 객체 - 'root'를 최상위로 변경
    const fileSystem = {
        'root': {
            type: 'folder',
            children: {
                'project': {
                    type: 'folder',
                    children: {
                        //'index': { type: 'file', content: "// 왼쪽 탐색기에서 파일을 선택해주세요."},
                        'make.html': { type: 'file', content: `<!DOCTYPE html>\n<html>\n<head>\n    <title>IDE Preview</title>\n    <link rel="stylesheet" href="style.css">\n</head>\n<body>\n    <h1>Welcome to your Web IDE!</h1>\n    <p>You can edit this in make.html</p>\n    <script src="script.js"><\/script>\n</body>\n</html>` },
                        'script.js': { type: 'file', content: 'console.log("Hello from script.js!");\n\n// Try changing the h1 text content!\ndocument.querySelector("h1").addEventListener("click", () => {\n    alert("You clicked the title!");\n});' },
                        'style.css': { type: 'file', content: 'body {\n  background-color: #2c3e50;\n  color: white;\n  font-family: sans-serif;\n  text-align: center;\n  padding-top: 50px;\n}' }
                    }
                }
            }
        }
    };

    // HTML 요소 가져오기
    const fileExplorerList = document.getElementById('file-explorer-list');
    const newFileButton = document.getElementById('new-file-button');
    const newFolderButton = document.getElementById('new-folder-button');
    const deleteButton = document.getElementById('delete-button');
    const runButton = document.getElementById('run-button');
    const resizer = document.getElementById('resizer');

    // --- 에디터 초기화 ---
    require(['vs/editor/editor.main'], function() {
        editor = monaco.editor.create(document.getElementById('editor-container'), {
            value: `// 왼쪽 탐색기에서 파일을 선택해주세요.`,
            language: 'html',
            theme: 'vs-dark',
            automaticLayout: true
        });
    });

    // --- UI 렌더링 ---
    function renderFileExplorer() {
        fileExplorerList.innerHTML = ''; // 목록 초기화
        // 시작점을 'fileSystem.root'로 변경
        createFileTree(fileExplorerList, fileSystem.root, 'root');
        
        // 초기 선택 및 파일 열기 경로 수정
        const initialFile = document.querySelector('[data-path="root/project/make.html"]');
        if(initialFile) {
            initialFile.click();

            // 'project' 폴더를 기본적으로 열어두기
            const projectFolderDiv = document.querySelector('[data-path="root/project"]');
            if(projectFolderDiv) {
                const subUl = projectFolderDiv.closest('li').querySelector('ul');
                if(subUl) subUl.style.display = 'block';
            }
        }
    }

    function createFileTree(parentElement, node, path) {
        if (!node.children) return;

        Object.entries(node.children).forEach(([name, data]) => {
            const li = document.createElement('li');
            const itemDiv = document.createElement('div');
            // 경로에서 'root/' 부분은 실제 경로에선 불필요하므로 조정
            const currentPath = path === 'root' ? name : `${path}/${name}`;
            itemDiv.className = 'flex items-center cursor-pointer hover:bg-opacity-20 hover:bg-white rounded p-1 transition-colors';
            itemDiv.dataset.path = `${path}/${name}`; // 데이터 경로는 전체 경로 유지
            
            const icon = document.createElement('span');
            icon.className = 'mr-2 flex-shrink-0 w-5';
            
            const nameSpan = document.createElement('span');
            nameSpan.textContent = name;
            nameSpan.className = 'truncate';

            itemDiv.append(icon, nameSpan);
            li.appendChild(itemDiv);

            // --- 선택 및 열기/토글 이벤트 핸들러 ---
            itemDiv.addEventListener('click', (e) => {
                e.stopPropagation();

                if (selectedItem && selectedItem.element) {
                    selectedItem.element.classList.remove('selected');
                }
                
                itemDiv.classList.add('selected');
                selectedItem = {
                    element: itemDiv,
                    name: name,
                    path: `${path}/${name}`,
                    parent: node.children,
                    type: data.type
                };

                if (data.type === 'file') {
                    switchToFile(name, data);
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
                    createFileTree(subUl, data, `${path}/${name}`);
                }
            } else {
                icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>`;
            }
            parentElement.appendChild(li);
        });
    }

    // --- 파일 관리 로직 ---
    function findNodeByPath(path) {
        const parts = path.split('/').filter(p => p);
        let current = fileSystem;
        for (const part of parts) {
            if (current.children && current.children[part]) {
                current = current.children[part];
            } else {
                // 'root'는 실제 파일이 아니므로 그 안의 children을 확인
                if (part === 'root' && current[part]) {
                    current = current[part];
                } else {
                    return null;
                }
            }
        }
        return current;
    }

    function switchToFile(name, data) {
        const currentFileName = document.getElementById('editor-tab-name').textContent;
        if(currentFileName && selectedItem) {
            const currentFileData = findNodeByPath(selectedItem.path.substring(0, selectedItem.path.lastIndexOf('/')) + '/' + currentFileName);
            if (currentFileData) {
                currentFileData.content = editor.getValue();
            }
        }
        editor.setValue(data.content);
        
        const extension = name.split('.').pop();
        const languages = { 'html': 'html', 'js': 'javascript', 'css': 'css' };
        monaco.editor.setModelLanguage(editor.getModel(), languages[extension] || 'plaintext');
        
        document.getElementById('editor-tab-name').textContent = name;
    }

    function createItem(type) {
        const name = prompt(`새 ${type === 'file' ? '파일' : '폴더'} 이름을 입력하세요:`);
        if (!name) return;

        let parentNode = fileSystem.root;
        if (selectedItem) {
            const selectedNode = findNodeByPath(selectedItem.path);
            if (selectedItem.type === 'folder' && selectedNode) {
                parentNode = selectedNode;
            } else {
                const parentPath = selectedItem.path.substring(0, selectedItem.path.lastIndexOf('/'));
                parentNode = findNodeByPath(parentPath);
            }
        }
        
        if (parentNode.children[name]) {
            showNotification("이미 존재하는 이름입니다.");
            return;
        }

        parentNode.children[name] = type === 'file' 
            ? { type: 'file', content: '' }
            : { type: 'folder', children: {} };
        renderFileExplorer();
    }
    
    function deleteSelectedItem() {
        if (!selectedItem) {
            showNotification("삭제할 파일이나 폴더를 선택하세요.");
            return;
        }
        if(selectedItem.path === 'root/project') {
             showNotification("최상위 프로젝트 폴더는 삭제할 수 없습니다.");
            return;
        }

        const { name, parent } = selectedItem;
        if (confirm(`'${name}'을(를) 정말 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
            const currentFileName = document.getElementById('editor-tab-name').textContent;
            if (name === currentFileName) {
                editor.setValue('// 파일이 삭제되었습니다.');
                document.getElementById('editor-tab-name').textContent = '';
            }

            delete parent[name];
            renderFileExplorer();
            selectedItem = null;
            showNotification(`'${name}'이(가) 삭제되었습니다.`);
        }
    }

    // --- 이벤트 리스너 등록 ---
    newFileButton.addEventListener('click', () => createItem('file'));
    newFolderButton.addEventListener('click', () => createItem('folder'));
    deleteButton.addEventListener('click', deleteSelectedItem);

    // --- 크기 조절 로직 ---
    const editorWrapper = document.getElementById('editor-wrapper');
    const terminalContainer = document.getElementById('terminal-container');
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
        const currentFileName = document.getElementById('editor-tab-name').textContent;
        if (!currentFileName || !selectedItem) {
            showNotification("실행할 파일을 선택해주세요.");
            return;
        }
        
        const currentFileData = findNodeByPath(selectedItem.path);
        if(!currentFileData || currentFileData.type !== 'file'){
             showNotification("선택된 항목이 파일이 아닙니다.");
             return;
        }
        currentFileData.content = editor.getValue();

        const output = document.getElementById('output');
        output.innerHTML = `<p>> Running ${currentFileName}...</p>`;
        
        const projectRoot = fileSystem.root.children.project;

        if (currentFileName.endsWith('.html')) {
            const iframe = document.createElement('iframe');
            iframe.style.width = '100%';
            iframe.style.height = 'calc(100% - 30px)';
            iframe.style.border = '1px solid #414868';
            iframe.style.backgroundColor = 'white';
            
            const cssFile = projectRoot.children['style.css'];
            const jsFile = projectRoot.children['script.js'];
            
            const srcDoc = `
                <html>
                    <head>
                        ${cssFile ? `<style>${cssFile.content}</style>` : ''}
                    </head>
                    <body>
                        ${currentFileData.content}
                        ${jsFile ? `<script>${jsFile.content}<\/script>` : ''}
                    </body>
                </html>
            `;
            iframe.srcdoc = srcDoc;
            output.appendChild(iframe);
        } else if (currentFileName.endsWith('.js')) {
            try {
                new Function(currentFileData.content)();
                output.innerHTML += `<p>> 실행이 완료되었습니다.</p>`
            } catch (e) {
                output.innerHTML += `<p class="text-red-400">Error: ${e.message}</p>`;
            }
        } else {
            output.innerHTML += `<p class="text-yellow-400">> 이 파일 타입은 직접 실행할 수 없습니다.</p>`;
        }
    });

    function showNotification(message) {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.classList.remove('hidden');
        setTimeout(() => notification.classList.add('hidden'), 3000);
    }
    
    // 초기화
    renderFileExplorer();
});