

module.exports = async function(name, config) {
    await new Promise((resolve) => {
        setTimeout(resolve, 1500);
    });
    console.log(name, config);
}