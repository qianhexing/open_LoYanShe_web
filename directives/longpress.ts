// /directives/longpress.ts
export default {
  mounted(el: HTMLElement, binding: any) {
    let pressTimer: any = null;

    const start = (e: Event) => {
      if (pressTimer === null) {
        pressTimer = setTimeout(() => {
          binding.value(e);
        }, 500); // 长按 500ms
      }
    };

    const cancel = () => {
      if (pressTimer !== null) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
    };

    // 鼠标事件
    el.addEventListener("mousedown", start);
    el.addEventListener("mouseup", cancel);
    el.addEventListener("mouseleave", cancel);

    // 触摸事件
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchend", cancel);
    el.addEventListener("touchmove", cancel);
  },

  unmounted(el: HTMLElement) {
    el.removeEventListener("mousedown", () => {});
    el.removeEventListener("mouseup", () => {});
    el.removeEventListener("mouseleave", () => {});
    el.removeEventListener("touchstart", () => {});
    el.removeEventListener("touchend", () => {});
    el.removeEventListener("touchmove", () => {});
  },
};
