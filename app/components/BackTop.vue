<script setup lang="ts">
const visible = ref(false)
let ticking = false

function onScroll() {
  if (ticking) return
  ticking = true
  requestAnimationFrame(() => {
    visible.value = window.scrollY > 300
    ticking = false
  })
}

function scrollToTop() {
  const behavior: ScrollBehavior =
    'scrollBehavior' in document.documentElement.style ? 'smooth' : 'auto'
  window.scrollTo({ top: 0, behavior })
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
})
onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))
</script>

<template>
  <Transition name="backtop">
    <button
      v-if="visible"
      type="button"
      class="fixed bottom-6 right-6 z-50 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-md ring-1 ring-inset ring-gray-200/60 transition hover:bg-gray-100 hover:text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
      title="返回顶部"
      :aria-label="'返回顶部'"
      @click="scrollToTop"
    >
      <span class="icon-[ph--arrow-up] text-lg" />
    </button>
  </Transition>
</template>

<style scoped>
.backtop-enter-active,
.backtop-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.backtop-enter-from,
.backtop-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>