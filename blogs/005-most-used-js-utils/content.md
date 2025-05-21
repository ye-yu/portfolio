I have been working as a software engineer for over 4 years now, doing both backend and frontend. Here are some of my most used JavaScript utilities that I have created and used in my projects. I hope you find them useful too!


# 1. Range iterator

Having to use a for loop to iterate over a range of numbers is common in JavaScript. However, using a generator function can make the code cleaner and more readable. The `range` function below allows you to create an iterator that generates numbers.

```ts
export function* range(n: number): Generator<number> {
  for (let i = 0; i < n; i++) {
    yield i;
  }
}
```

This is particularly useful in Vue.js when you want to create components with data model array, but you cannot bind the data model item directly to the component. 

```vue
<script setup lang="ts">
import { range } from './utils';

const data = ref({
  items: [1, 2, 3, 4, 5],
});
</script>

<template>
  <div>
    <div v-for="i in range(5)" :key="i">
      <!-- 
        this wouldnt work:
          <input v-model="data.items[i]" /> 

        do this instead:
       -->

      <input :value="data.items[i]" @input="(event) => data.items[i] = event.target.value" />
    </div>
  </div>
</template>
```

# 2. Delayed promise

When loading async data, sometimes the data arrives too fast and the browser does not update the UI smoothly. To solve this, you can use a delayed promise that waits for a specified amount of time before resolving. In this example, I choose to polifill the `Promise` class to add a `delayed` method. 

```ts
declare global {
  interface Promise<T> {
    delayed(ms: number): Promise<T>;
  }
}
Promise.prototype.delayed = function (ms: number) {
  return Promise.all([this, new Promise((resolve) => setTimeout(resolve, ms))]).then(([result]) => result);
};
```

This will allow the promise to resolve at least `ms` milliseconds after the promise is created. You can use this in your code like this:

```ts
const data = await fetchData().delayed(1000);
```

This will ensure that the data is not loaded too quickly and gives the browser time to update the UI smoothly.

# 3. Chunked array

When working with large arrays, it can be useful to split them into smaller chunks. This can help with performance and readability. The `chunk` function below allows you to create an array of arrays, where each inner array is a chunk of the original array.


Once more, I choose to polifill the `Array` class to add a `chunk` method. 
```ts
declare global {
  interface Array<T> {
    chunk(size: number): Generator<Array<T>>;
  }
}

Array.prototype.chunk = function* (size: number): Generator<Array<any>> {
  let iterated = a;
  while (iterated.length) {
    const chunk = iterated.slice(0, chunkSize);
    iterated = iterated.slice(chunkSize);
    yield chunk;
  }
};
```

# 4. Rate limit request

We can combine the `chunk` method with the `delayed` method to create a rate limit request function. This is particularly useful
when there is a bulk upload request and we are able to split to request into smaller chunks.


```ts
async function chunkedAsync<T>(data: T[], task: (item: T) => Promise<any[]>, chunkSize: number, delay: number) {
  let result: any[] = []
  for (const chunk of data.chunk(chunkSize)) {
    const item = await task(item).delayed(delay);
    result = [...result, ...item];
  }
  return result;
}
```
