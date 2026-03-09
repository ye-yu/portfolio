A few years back, I learnt the Two Pointers Technique to solve many array traversal problems. It was such a revelation and an inspiration to me to write even more complicated code and brag about it in a blog post like this, except that I didn't actually brag about it because I was too lazy to write a blog post. See the final code snippet in the gist here: [quickSortStack.ts](https://gist.github.com/ye-yu/3f5d3bac5f1af9a08935d18592ed1912)

> MAFA: because MSFA (make sorting fast again) does not make a good acronym.

Two Pointers Technique, in simpler terms, is a way to read through an array from both ends at the same time, and usually you would also name those pointers `left` and `right`. Recalling back this technique, I was curious if I could implement it correctly. So, I chose the array sorting problem and implemented a variation of a "quick" sort, which is an algorithm that uses pivots to partition the array into smaller sub-arrays, and then recursively sorts those sub-arrays.

## How Quick Sort is Usually Implemented
In a typical quicksort implementation, the algorithm follows a recursive divide-and-conquer approach. You pick a **pivot** element, partition the array so that smaller elements are on the left and larger elements are on the right, then recursively sort each partition.

```ts
function quickSort(arr: number[]): number[] {
    if (arr.length <= 1) return arr;

    const pivot = arr[0];
    const left = arr.slice(1).filter(x => x <= pivot);
    const right = arr.slice(1).filter(x => x > pivot);

    return [...quickSort(left), pivot, ...quickSort(right)];
}
```

This is clean and easy to reason about. But notice what happens at every level of recursion: `slice` and `filter` create new arrays, and the spread operator allocates yet another array for the result. For an array of length _n_, you end up allocating O(n log n) worth of temporary arrays. That's a lot of garbage for the garbage collector to clean up, and for very large arrays it can become a real performance bottleneck.

## Replacing the Internals with Two Pointers

Instead of splitting and merging into new arrays, what if we stayed in-place? This is where the Two Pointers Technique comes in. The idea is to pick a **pivot** element (say, the first element of the sub-array), then walk a `left` pointer from the beginning and a `right` pointer from the end, rearranging elements so that everything smaller than the pivot ends up before it, and everything greater ends up after it.

In the implementation, the partitioning loop does exactly this:

```ts
while (leftIndex <= rightIndex) {
  const left = arrayView.get(leftIndex);
  const right = arrayView.get(rightIndex);

  if (p > left) {
    // left is smaller than pivot - swap pivot and left, advance both
    arrayView.set(pIndex, left);
    arrayView.set(leftIndex, p);
    pIndex++;
    leftIndex++;
    continue;
  }

  if (p <= left) {
    // left is >= pivot - swap it to the right end, shrink right boundary
    arrayView.set(leftIndex, right);
    arrayView.set(rightIndex, left);
    rightIndex--;
  }
}
```

When `p > left`, the left element belongs before the pivot, so we swap the pivot one position forward and the smaller element takes the pivot's old spot. When `p <= left`, that element is too big to be on the left side, so we send it to the right end by swapping it with whatever is at `right`, and shrink the window by decrementing `rightIndex`.

Once the loop finishes, the pivot sits at its correct sorted position, and we have two partitions - one on each side - that still need sorting. No temporary arrays were created. All swaps happened directly on the original array. The `ArrayView` class makes this ergonomic by letting us treat sub-ranges of the array as if they were standalone arrays, using an `offset` and `length` rather than copying data.

## The Simplicity of Recursion

The most natural way to express this kind of divide-and-conquer is through recursion. Even quick sort can be written in just a few lines of code:

```ts
function quicksort(arr: number[], lo: number, hi: number) {
  if (lo >= hi) return;

  const pivotIndex = partition(arr, lo, hi);
  quicksort(arr, lo, pivotIndex - 1);
  quicksort(arr, pivotIndex + 1, hi);
}
```

Three lines. Beautifully simple. The recursive structure mirrors the problem itself - partition, then sort each half. You barely have to think about bookkeeping; the call stack keeps track of which sub-arrays still need processing. This elegance is exactly why recursion is usually the first approach taught for divide-and-conquer algorithms.

## When Recursion Becomes the Problem

But here's the catch: every recursive call adds a frame to the call stack. For a well-balanced partition, the recursion depth is O(log n), which is fine for most practical arrays. But in the worst case - say the array is already sorted or nearly sorted and you always pick the first element as the pivot - the recursion depth becomes O(n). For an array with tens of millions of elements, that means tens of millions of stack frames.

JavaScript engines have a finite call stack. Exceed that, and you get the dreaded:

```
RangeError: Maximum call stack size exceeded
```

This isn't a theoretical concern. If you're sorting a large dataset that happens to be pre-sorted or nearly sorted, a naive recursive quicksort will crash your application.

## Solving It in a Single Function Call with a Tracked Pivot Stack

Our implementation for the two pointers technique sidesteps this entirely by replacing the implicit call stack with an explicit one - the `pivots` array:

```ts
export function tpStack<T>(arr: Array<T>) {
  const pivots = new Array<ArrayView<T>>();
  pivots.push(new ArrayView(arr, 0, arr.length));

  do {
    const arrayView = pivots.pop()!;
    // ... partition logic ...
    pivots.push(arrayView.slice(0, pIndex));
    pivots.push(arrayView.slice(pIndex, length));
  } while (pivots.length);
}
```

Instead of recursing, the function maintains a stack of `ArrayView` objects, each representing a sub-array that still needs to be sorted. The `do...while` loop pops a sub-array, partitions it using the two-pointer technique, and pushes the resulting left and right partitions back onto the stack. The whole sort completes within a **single function call** - no recursion, no risk of blowing the call stack.

The `ArrayView` class is the key enabler here. It holds a reference to the **original** array along with an `offset` and `length`, so "slicing" a sub-array is just creating a lightweight view object - no data is copied. This means the tracked pivot stack only stores small descriptor objects, not array copies, keeping memory overhead minimal even for massive arrays.

The base cases are handled efficiently too: sub-arrays of length 1 or less are already sorted and get skipped, while sub-arrays of exactly length 2 just need a single comparison and at most one swap. This avoids unnecessary partitioning overhead for trivially small segments.

The result is an in-place, iterative, stack-safe sorting algorithm that combines the best of both worlds: the logical clarity of divide-and-conquer with the robustness of an iterative approach. No extra arrays allocated for merging, no call stack limits to worry about - just one function call that sorts the array, no matter how large it is.

## What the major JS Engines do

> Algorithm Behind JavaScript Array.prototype.sort

The ECMAScript specification does not mandate a specific sorting algorithm for Array.prototype.sort(). This means the actual algorithm depends on the JavaScript engine implementation. However, since ES2019, the spec requires the sort to be stable, ensuring that elements with equal sort keys retain their original order .

Current Implementations in Major Engines:
- V8 (used in Chrome, Node.js, Deno): Uses TimSort since Chrome 70 (2018), which is a hybrid of merge sort and insertion sort, optimized for partially sorted data.
- SpiderMonkey (Firefox): Uses a stable merge sort.
- JavaScriptCore (Safari): Uses a stable sorting algorithm, historically merge sort or a variant.

Why TimSort in V8? TimSort offers O(n log n) worst-case complexity and O(n) for nearly sorted data, making it efficient for real-world scenarios where data often has ordered sequences. It also guarantees stability, aligning with ES2019 requirements.

## Benchmarking
I approach the benchmarking in two methods:
- Integrity test: to ensure that my implementation produces the same sorted output as the built-in `sort` method.
- Performance test: to compare the execution time of my implementation against the built-in `sort` method given the random array that is normally distributed.

After validating that the outputs are identical, I run performance benchmarks on arrays in 30 runs and compare the average resource usage and execution time of both implementations.

Here are the results of the benchmark:

| Metric | builtIn | custom | % |
| --- | --- | --- | --- |
| Heap Used (MB) | 112 | 59 | 46 |
| Heap Total (MB) | 135 | 84 | 37 |
| Heap Usage (%) | 80 | 66 | 17 |
| RSS (MB) | 378 | 371 | 1 |
| CPU User Time (ms) | 524 | 173 | 66 |
| CPU System Time (ms) | 7 | 5 | 26 |
| Elapsed Time (ms) | 543 | 189 | 65 |


The custom implementation cuts heap usage nearly in half, which is consistent with its in-place partitioning and lack of temporary array allocations. User CPU time drops by roughly two thirds, suggesting the built-in sort is doing more work per element for this distribution and data size. System time is low for both, so the difference is dominated by user-space computation rather than OS overhead. 

## Conclusion

Overall, the custom implementation demonstrates significant performance improvements in both memory usage and execution time compared to the built-in `sort`, especially for large arrays with a normal distribution. This validates the efficiency of the two pointers technique and in-place partitioning approach.

However, given that in real world applications, the built-in `sort` is already optimized for daily use cases, the performance benefits of a custom implementation may vary based on the specific use case and data characteristics. For small arrays or already sorted data, the built-in `sort` may perform better due to lower overhead.

All in all, this has been a great exploration on how two pointers technique can be a tool to optimize sorting algorithms and how it can be implemented in a way that avoids recursion and minimizes memory usage. Maybe I should sample actual data from real applications and benchmark against that to see how it performs in practice!