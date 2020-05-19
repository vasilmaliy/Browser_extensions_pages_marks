let myLog = new File("src/js/pagemark.js");
const sum = require('src/js/pagemark.js');
// See if the file exists
test('if main script file exists', () => {
    expect(myLog.exists()).toBe(true);
});
