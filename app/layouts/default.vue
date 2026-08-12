<script setup lang="ts">
const ui = useUiStore()
const { init: initTheme } = useTheme()

onMounted(initTheme)
</script>

<template>
  <div class="min-h-screen bg-gray-100 font-sans text-gray-900 transition-colors dark:bg-gray-950 dark:text-gray-100">
    <slot />
    <LoginModal v-if="ui.showLogin" />
    <SearchModal v-if="ui.showSearch" />
    <PostEditorModal v-if="ui.editingPost" />
    <ToastViewport />
    <BackTop />
  </div>
</template>
