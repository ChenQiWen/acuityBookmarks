<script setup lang="ts">
import { ref, onMounted } from 'vue';
import axios from 'axios';

const tabUrl = ref('');
const tabTitle = ref('');
const message = ref('');
const isLoading = ref(false);

onMounted(() => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      tabUrl.value = tabs[0].url || 'No URL found';
      tabTitle.value = tabs[0].title || 'No title found';
    }
  });
});

const addBookmark = async () => {
  if (!tabUrl.value || tabUrl.value === 'No URL found') {
    message.value = 'Cannot add a bookmark without a valid URL.';
    return;
  }
  isLoading.value = true;
  message.value = '';
  try {
    await axios.post('http://localhost:3000/api/process-bookmarks', {
      url: tabUrl.value,
      title: tabTitle.value,
    });
    message.value = 'Bookmark added successfully!';
  } catch (error) {
    console.error('Error adding bookmark:', error);
    message.value = 'Failed to add bookmark.';
  } finally {
    isLoading.value = false;
  }
};

const openManagement = () => {
  const managementUrl = chrome.runtime.getURL('management.html');
  chrome.tabs.create({ url: managementUrl });
};
</script>

<template>
  <div class="popup-container">
    <h2>Add Bookmark</h2>
    <div class="tab-info">
      <p><strong>Title:</strong> {{ tabTitle }}</p>
      <p><strong>URL:</strong> {{ tabUrl }}</p>
    </div>
    <button @click="addBookmark" :disabled="isLoading">
      {{ isLoading ? 'Adding...' : 'Add Bookmark' }}
    </button>
    <button @click="openManagement">Manage Bookmarks</button>
    <p v-if="message" class="message">{{ message }}</p>
  </div>
</template>

<style scoped>
.popup-container {
  width: 300px;
  padding: 15px;
  font-family: sans-serif;
}
.tab-info {
  word-wrap: break-word;
  margin-bottom: 15px;
}
button {
  margin-top: 5px;
  width: 100%;
  padding: 8px;
  cursor: pointer;
}
.message {
  margin-top: 10px;
  font-weight: bold;
}
</style>