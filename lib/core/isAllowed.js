
module.exports = function (users) {
  return function (login, token) {
    const user = users[login]

    // user not found
    if (!user) {
      return false
    }

    // check if the user's token exists and is set to true
    return Boolean(user[token])
  }
}
