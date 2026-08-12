<script setup lang="ts">
const emit = defineEmits<{ close: [] }>()

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close')
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-40 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="emit('close')" />
      <div class="relative w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 text-gray-900 shadow-xl dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
        <button
          class="icon-btn absolute right-3 top-3"
          aria-label="关闭"
          @click="emit('close')"
        >
          <span class="icon-[ph--x]" />
        </button>
        <slot />
      </div>
    </div>
  </Teleport>
</template>
