export function installPrototypeMethods(targetClass, methodsClass) {
    for (const name of Object.getOwnPropertyNames(methodsClass.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            targetClass.prototype,
            name,
            Object.getOwnPropertyDescriptor(methodsClass.prototype, name)
        );
    }
}
