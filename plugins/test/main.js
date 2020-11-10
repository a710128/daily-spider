
async function main(name, config) {
    await new Promise((resolve) => {
        setTimeout(resolve, 1500);
    });
    console.log(name, config);
}

async function cleanup(name, config) {
    await new Promise((resolve) => {
        setTimeout(resolve, 1500);
    });
    console.log(name, config);
}

module.exports = {
    main,
    cleanup
}