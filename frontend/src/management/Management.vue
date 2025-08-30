<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import axios from 'axios';
import { Sortable } from 'sortablejs-vue3';

interface Bookmark {
  _id: string;
  title: string;
  url: string;
}

const bookmarks = ref<Bookmark[]>([]);
const searchQuery = ref('');
const isLoading = ref(true);
const error = ref('');

const fetchBookmarks = async () => {
  isLoading.value = true;
  error.value = '';
  try {
    const response = await axios.get('http://localhost:3000/api/process-bookmarks');
    bookmarks.value = response.data;
  } catch (err) {
    console.error('Error fetching bookmarks:', err);
    error.value = 'Failed to load bookmarks.';
  } finally {
    isLoading.value = false;
  }
};

onMounted(fetchBookmarks);

const filteredBookmarks = computed(() => {
  if (!searchQuery.value) {
    return bookmarks.value;
  }
  return bookmarks.value.filter(b =>
    b.title.toLowerCase().includes(searchQuery.value.toLowerCase())
  );
});

const deleteBookmark = async (id: string) => {
  try {
    await axios.delete(`http://localhost:3000/api/process-bookmarks?id=${id}`);
    bookmarks.value = bookmarks.value.filter(b => b._id !== id);
  } catch (err) {
    console.error('Error deleting bookmark:', err);
    alert('Failed to delete bookmark.');
  }
};

const onDragEnd = async () => {
  // sortablejs-vue3 updates the v-model automatically.
  // We just need to send the new order to the backend.
  const orderedIds = bookmarks.value.map(b => b._id);
  try {
    await axios.put('http://localhost:3000/api/process-bookmarks', {
      order: orderedIds,
    });
  } catch (err) {
    console.error('Error updating bookmark order:', err);
    alert('Failed to save the new order. Please refresh.');
    // Optionally, refresh to get the correct state from the server
    await fetchBookmarks();
  }
};
</script>

<template>
  <div class="management-container">
    <h1>Manage Bookmarks</h1>
    <input type="text" v-model="searchQuery" placeholder="Search bookmarks..." class="search-input" />

    <div v-if="isLoading">Loading...</div>
    <div v-if="error" class="error">{{ error }}</div>

    <div v-if="!isLoading && !error">
      <!-- Draggable list when not searching -->
      <Sortable v-if="!searchQuery" :list="bookmarks" item-key="_id" @end="onDragEnd" tag="ul" class="bookmark-list">
        <template #item="{ element }">
          <li class="bookmark-item">
            <a :href="element.url" target="_blank">{{ element.title }}</a>
            <button @click="deleteBookmark(element._id)" class="delete-btn">Delete</button>
          </li>
        </template>
      </Sortable>

      <!-- Non-draggable list when searching -->
      <ul v-else class="bookmark-list">
        <li v-for="element in filteredBookmarks" :key="element._id" class="bookmark-item non-draggable">
          <a :href="element.url" target="_blank">{{ element.title }}</a>
          <button @click="deleteBookmark(element._id)" class="delete-btn">Delete</button>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.management-container {
  padding: 20px;
  font-family: sans-serif;
}
.search-input {
  width: 100%;
  padding: 10px;
  margin-bottom: 20px;
  box-sizing: border-box;
}
.bookmark-list {
  list-style: none;
  padding: 0;
}
.bookmark-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  border: 1px solid #ccc;
  margin-bottom: 5px;
  background-color: #f9f9f9;
  cursor: move;
}
.bookmark-item.non-draggable {
  cursor: default;
}
.delete-btn {
  cursor: pointer;
  background-color: #ff4d4d;
  color: white;
  border: none;
  padding: 5px 10px;
  border-radius: 3px;
}
.error {
  color: red;
}
</style>
