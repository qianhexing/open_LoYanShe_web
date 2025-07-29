import Quill from 'quill';

// 定义 Quill 类型补充（因为 getModule 返回的类型需要扩展）
declare module 'quill' {
  interface Toolbar {
    addHandler: (format: string, handler: () => void) => void;
  }
}

// 自定义按钮功能
export function setupCustomToolbar(quill: Quill): void {
  // 1. 自定义插入模板按钮
  // const insertTemplate = (): void => {
  //   const range = quill.getSelection();
  //   if (range) {
  //     quill.insertText(range.index, '【预设模板】\n这是自动插入的内容\n');
  //   }
  // };
  
  const insertTemplate= (): void => {
    // 确保编辑器获得焦点
    quill.focus();
    console.log('位置', quill)
    // const range = quill.getSelection() || { index: quill.getLength() };
    // console.log(range, '位置')
    quill.insertText(0, '【模板内容】\n这是自动插入的内容\n');
    // quill.insertEmbed(0, 'editorLibrary', '【模板内容】\n这是自动插入的内容\n')
  };

  // 2. 自定义插入用户标签按钮
  const insertUserTag = (): void => {
    const range = quill.getSelection();
    if (range) {
      const insertPosition = range.index;
      quill.insertText(insertPosition, '@USER', { bold: true, color: '#1890ff' });
      quill.formatText(insertPosition, 5, { background: '#f0f5ff' });
    }
  };
  // toolbar.addHandler('editorLibrary', (value) => {
  //   if (value) {
  //     console.log(this.quill.getSelection())
  //     if (this.quill.getSelection()) {
  //       this.mouseIndex = this.quill.getSelection().index
  //     } else {
  //       this.mouseIndex = 0
  //     }
  //     this.$refs.chooseLibrary.showModel()
  //   } else {
  //     this.quill.format('editorLibrary', false)
  //   }
  // })

  // 添加到工具栏（需要类型断言）
  const toolbar = quill.getModule('toolbar') as Quill['getModule'] extends (name: 'toolbar') => infer R ? R : never;
  console.log('工具栏', toolbar)
  if (toolbar) {
    toolbar.addHandler('insertTemplate', insertTemplate);
    toolbar.addHandler('insertUserTag', insertUserTag);
  }
}