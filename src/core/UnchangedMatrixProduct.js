import { Matrix4 } from 'three';

function sameElements(a, b) {
    // Like Three's Matrix4.equals, keep this fixed-size hot comparison unrolled.
    // Object.is additionally distinguishes signed zero for exact arithmetic.
    return Object.is(a[0], b[0]) && Object.is(a[1], b[1]) && Object.is(a[2], b[2]) && Object.is(a[3], b[3]) &&
        Object.is(a[4], b[4]) && Object.is(a[5], b[5]) && Object.is(a[6], b[6]) && Object.is(a[7], b[7]) &&
        Object.is(a[8], b[8]) && Object.is(a[9], b[9]) && Object.is(a[10], b[10]) && Object.is(a[11], b[11]) &&
        Object.is(a[12], b[12]) && Object.is(a[13], b[13]) && Object.is(a[14], b[14]) && Object.is(a[15], b[15]);
}

// Cache arithmetic only. Object3D's ordinary traversal, force propagation and
// dirty flags remain intact, including manual descendant writes. Validate the
// result too: a caller may have overwritten matrixWorld directly since use.
export function cacheUnchangedMatrixProduct(matrix) {
    if (!matrix?.isMatrix4 || matrix.multiplyMatrices !== Matrix4.prototype.multiplyMatrices) return null;
    const original = matrix.multiplyMatrices;
    const descriptor = Object.getOwnPropertyDescriptor(matrix, 'multiplyMatrices');
    const left = new Matrix4(), right = new Matrix4(), result = new Matrix4();
    let active = true, valid = false;
    function multiply(a, b) {
        if (!active || this !== matrix) return original.call(this, a, b);
        // In-place aliases overwrite an operand. Keep ordinary multiplication
        // and invalidate instead of accidentally caching the post-write input.
        if (a === matrix || b === matrix || !a?.isMatrix4 || !b?.isMatrix4) {
            valid = false;
            return original.call(this, a, b);
        }
        if (!valid || !sameElements(a.elements, left.elements) ||
            !sameElements(b.elements, right.elements) || !sameElements(matrix.elements, result.elements)) {
            original.call(matrix, a, b);
            left.copy(a); right.copy(b); result.copy(matrix); valid = true;
        }
        return matrix;
    }
    matrix.multiplyMatrices = multiply;
    return () => {
        active = false;
        if (matrix.multiplyMatrices !== multiply) return;
        if (descriptor) Object.defineProperty(matrix, 'multiplyMatrices', descriptor);
        else delete matrix.multiplyMatrices;
    };
}
