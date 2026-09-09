// A hover is historical evidence. A live actor can cross the pointer before
// the click; only the fresh click's complete selection/intent record proves it.
export function isHostilePointerInterception(click) {
    const target = click?.after;
    return click?.result === true && click.dom === 'CANVAS' && click.mobile === false &&
        typeof target?.id === 'string' && target.id.length > 0 &&
        target.hostile === true && target.active === true && target.state !== 'DEAD' &&
        click.stack?.[0]?.id === target.id && click.stack[0].hostile === true &&
        click.pending?.id === target.id && click.pending.hostile === true;
}
