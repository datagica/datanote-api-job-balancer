Array.prototype.removeIf = function(callback) {
  let i = this.length
  while (i--) {
    if (callback(this[i], i)) {
      const item = this[i]
      this.splice(i, 1)
      return item
    }
  }
  return null
}
