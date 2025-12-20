import { jest } from '@jest/globals';
import { SkillStrategy } from '../src/skills/SkillStrategy.js';

describe('SkillStrategy', () => {
    describe('constructor', () => {
        test('initializes with name, cooldown, and resourceCost', () => {
            const skill = new SkillStrategy('Fireball', 1000, 25);
            
            expect(skill.name).toBe('Fireball');
            expect(skill.cooldown).toBe(1000);
            expect(skill.resourceCost).toBe(25);
            expect(skill.lastUsed).toBe(0);
        });

        test('handles zero cooldown', () => {
            const skill = new SkillStrategy('BasicAttack', 0, 0);
            
            expect(skill.cooldown).toBe(0);
            expect(skill.resourceCost).toBe(0);
        });

        test('handles large cooldown values', () => {
            const skill = new SkillStrategy('Ultimate', 60000, 100);
            
            expect(skill.cooldown).toBe(60000);
        });
    });

    describe('canExecute', () => {
        test('returns true when skill has never been used', () => {
            const skill = new SkillStrategy('Fireball', 1000, 25);
            const owner = { stats: { mana: 100 } };
            
            expect(skill.canExecute(owner)).toBe(true);
        });

        test('returns false when skill is on cooldown', () => {
            const skill = new SkillStrategy('Fireball', 1000, 25);
            const owner = { stats: { mana: 100 } };
            
            // Simulate recent use
            skill.lastUsed = Date.now();
            
            expect(skill.canExecute(owner)).toBe(false);
        });

        test('returns true when cooldown has expired', () => {
            const skill = new SkillStrategy('Fireball', 1000, 25);
            const owner = { stats: { mana: 100 } };
            
            // Simulate use 2 seconds ago (cooldown is 1 second)
            skill.lastUsed = Date.now() - 2000;
            
            expect(skill.canExecute(owner)).toBe(true);
        });

        test('returns false when exactly at cooldown boundary', () => {
            const skill = new SkillStrategy('Fireball', 1000, 25);
            const owner = { stats: { mana: 100 } };
            
            // Set lastUsed to exactly cooldown ms ago
            skill.lastUsed = Date.now() - 999;
            
            expect(skill.canExecute(owner)).toBe(false);
        });

        test('returns true with zero cooldown after use', () => {
            const skill = new SkillStrategy('BasicAttack', 0, 0);
            const owner = { stats: { mana: 100 } };
            
            skill.lastUsed = Date.now();
            
            // Zero cooldown means it should always be available
            expect(skill.canExecute(owner)).toBe(true);
        });
    });

    describe('execute', () => {
        test('updates lastUsed when executed successfully', () => {
            const skill = new SkillStrategy('Fireball', 1000, 25);
            const owner = { stats: { mana: 100 } };
            const targetVector = { x: 10, z: 20 };
            
            const beforeExecute = Date.now();
            skill.execute(owner, targetVector);
            const afterExecute = Date.now();
            
            expect(skill.lastUsed).toBeGreaterThanOrEqual(beforeExecute);
            expect(skill.lastUsed).toBeLessThanOrEqual(afterExecute);
        });

        test('does not update lastUsed when on cooldown', () => {
            const skill = new SkillStrategy('Fireball', 1000, 25);
            const owner = { stats: { mana: 100 } };
            const targetVector = { x: 10, z: 20 };
            
            // First execution
            skill.execute(owner, targetVector);
            const firstLastUsed = skill.lastUsed;
            
            // Try to execute again immediately
            skill.execute(owner, targetVector);
            
            // lastUsed should not have changed
            expect(skill.lastUsed).toBe(firstLastUsed);
        });

        test('calls perform when canExecute is true', () => {
            const skill = new SkillStrategy('Fireball', 1000, 25);
            const owner = { stats: { mana: 100 } };
            const targetVector = { x: 10, z: 20 };
            
            // Spy on perform
            const performSpy = jest.spyOn(skill, 'perform');
            
            skill.execute(owner, targetVector);
            
            expect(performSpy).toHaveBeenCalledWith(owner, targetVector);
        });

        test('does not call perform when on cooldown', () => {
            const skill = new SkillStrategy('Fireball', 1000, 25);
            const owner = { stats: { mana: 100 } };
            const targetVector = { x: 10, z: 20 };
            
            // Put skill on cooldown
            skill.lastUsed = Date.now();
            
            const performSpy = jest.spyOn(skill, 'perform');
            
            skill.execute(owner, targetVector);
            
            expect(performSpy).not.toHaveBeenCalled();
        });
    });

    describe('perform', () => {
        test('logs warning when called on base class', () => {
            const skill = new SkillStrategy('Fireball', 1000, 25);
            const owner = { stats: { mana: 100 } };
            const targetVector = { x: 10, z: 20 };
            
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            
            skill.perform(owner, targetVector);
            
            expect(warnSpy).toHaveBeenCalledWith('SkillStrategy.perform() must be implemented by subclass');
            
            warnSpy.mockRestore();
        });
    });

    describe('subclass behavior', () => {
        test('subclass can override perform', () => {
            class FireballSkill extends SkillStrategy {
                constructor() {
                    super('Fireball', 1000, 25);
                    this.performed = false;
                }

                perform(owner, targetVector) {
                    this.performed = true;
                }
            }

            const fireball = new FireballSkill();
            const owner = { stats: { mana: 100 } };
            
            fireball.execute(owner, { x: 0, z: 0 });
            
            expect(fireball.performed).toBe(true);
        });

        test('subclass inherits cooldown behavior', () => {
            class HealSkill extends SkillStrategy {
                constructor() {
                    super('Heal', 5000, 50);
                }

                perform(owner, targetVector) {
                    owner.health += 20;
                }
            }

            const heal = new HealSkill();
            const owner = { stats: { mana: 100 }, health: 50 };
            
            heal.execute(owner, null);
            expect(owner.health).toBe(70);
            
            // Try to heal again immediately - should fail due to cooldown
            heal.execute(owner, null);
            expect(owner.health).toBe(70); // No change
        });
    });
});
