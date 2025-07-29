<template>
  <div>
    <!-- 自定义工具栏容器 -->
    <div id="custom-toolbar">
      <button class="ql-bold"></button>
      <button class="ql-italic"></button>
      <button class="ql-insertTemplate">嘎</button>
      <button class="ql-insertUserTag">@</button>
    </div>

    <!-- 编辑器容器 -->
    <div id="editor-container"></div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';

const Embed = Quill.import('blots/embed');

const editor = ref(null);

// 自定义不可编辑的块级组件
class BlockEmbed extends Embed {
  static create(value) {
    const node = super.create();
    node.setAttribute('data-block', 'true');
    node.classList.add('ql-custom-block');

    const section = document.createElement('div');
    section.setAttribute('style', 'font-size: 12px;');
    section.innerText = '嘎嘎嘎嘎嘎';

    node.appendChild(section);
    return node;
  }

  static value(node) {
    return node.innerHTML;
  }
}

BlockEmbed.blotName = 'customBlock';
BlockEmbed.tagName = 'div';
BlockEmbed.className = 'ql-custom-block';
Quill.register(BlockEmbed);

onMounted(() => {
  editor.value = new Quill('#editor-container', {
    modules: {
      toolbar: {
        container: '#custom-toolbar',
        handlers: {
          insertTemplate: function () {
            const quill = this.quill;
            quill.focus();
            const range = quill.getSelection();
            const position = range ? range.index : quill.getLength();
            quill.insertEmbed(position, 'customBlock', true);
          }
        }
      }
    },
    placeholder: '输入内容...',
    theme: 'snow'
  });
});

// 获取内容的方法
const getContent = () => {
  return editor.value.root.innerHTML;
};
</script>

<style>
/* 自定义工具栏按钮样式 */
#custom-toolbar {
  background: #f3f3f3;
  padding: 8px;
  border-radius: 4px 4px 0 0;
}
#custom-toolbar button {
  margin-right: 8px;
  padding: 4px 8px;
}
.ql-insertTemplate::after {
}
.ql-insertUserTag::after {
}
#editor-container {
  height: 300px;
  border: 1px solid #ddd;
  border-radius: 0 0 4px 4px;
}
</style>