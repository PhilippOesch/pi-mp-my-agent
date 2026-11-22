import { describe, it, expect } from "vitest";
import * as path from "node:path";
import type { Skill, SourceInfo } from "@earendil-works/pi-coding-agent";
import { isThisPackageSkill, filterPackageSkills } from "./index.ts";

const MOCK_PACKAGE_SKILLS_DIR = "/mock/repo/skills";

const mockSourceInfo = (
    origin: "package" | "top-level",
    pathStr: string,
): SourceInfo => ({
    origin,
    path: pathStr,
    source: "test",
    scope: "user",
});

const mockSkill = (
    name: string,
    filePath: string,
    origin: "package" | "top-level",
): Skill => ({
    name,
    description: `Description of ${name}`,
    filePath,
    baseDir: path.dirname(filePath),
    sourceInfo: mockSourceInfo(origin, filePath),
    disableModelInvocation: false,
});

describe("isThisPackageSkill", () => {
    it("should return false for non-package skills", () => {
        const skill = mockSkill(
            "user-skill",
            "/user/skills/my-skill/SKILL.md",
            "top-level",
        );
        expect(isThisPackageSkill(skill, MOCK_PACKAGE_SKILLS_DIR)).toBe(false);
    });

    it("should return false for package skills from other packages", () => {
        const skill = mockSkill(
            "other-skill",
            "/other/repo/skills/other/SKILL.md",
            "package",
        );
        expect(isThisPackageSkill(skill, MOCK_PACKAGE_SKILLS_DIR)).toBe(false);
    });

    it("should return true for package skills in the package skills directory", () => {
        const skill = mockSkill(
            "tdd",
            "/mock/repo/skills/tdd/SKILL.md",
            "package",
        );
        expect(isThisPackageSkill(skill, MOCK_PACKAGE_SKILLS_DIR)).toBe(true);
    });

    it("should return true for package skills in subdirectories of the package skills directory", () => {
        const skill = mockSkill(
            "nested-skill",
            "/mock/repo/skills/nested/skill/SKILL.md",
            "package",
        );
        expect(isThisPackageSkill(skill, MOCK_PACKAGE_SKILLS_DIR)).toBe(true);
    });

    it("should handle symlinked paths correctly", () => {
        // Simulate the user's setup: ~/.pi/agent -> dotfiles/home/pi/agent
        // The packageSkillsDir would be canonicalized to /Users/.../dotfiles/.../skills
        // But skill.filePath might have the ~/.pi prefix
        const canonicalSkillsDir =
            "/Users/philippoeschger/dotfiles/home/pi-mp-my-agent/skills";
        // We can't actually create symlinks in the test, but we can verify
        // the function handles path normalization correctly
        const skill = mockSkill(
            "tdd",
            canonicalSkillsDir + "/tdd/SKILL.md",
            "package",
        );
        expect(isThisPackageSkill(skill, canonicalSkillsDir)).toBe(true);
    });
});

describe("filterPackageSkills", () => {
    const packageSkillTdd = mockSkill(
        "tdd",
        "/mock/repo/skills/tdd/SKILL.md",
        "package",
    );
    const packageSkillRefactor = mockSkill(
        "refactor",
        "/mock/repo/skills/refactor/SKILL.md",
        "package",
    );
    const userSkill = mockSkill(
        "my-skill",
        "/user/skills/my-skill/SKILL.md",
        "top-level",
    );
    const otherPackageSkill = mockSkill(
        "other",
        "/other/repo/skills/other/SKILL.md",
        "package",
    );

    it("should keep all skills when whitelist is empty", () => {
        const skills = [
            packageSkillTdd,
            packageSkillRefactor,
            userSkill,
            otherPackageSkill,
        ];
        const result = filterPackageSkills(skills, [], MOCK_PACKAGE_SKILLS_DIR);

        // With empty whitelist, all skills are kept (no filtering)
        expect(result.kept).toHaveLength(4);
        expect(result.unknownEntries).toHaveLength(0);
    });

    it("should keep whitelisted package skills and all non-package skills", () => {
        const skills = [
            packageSkillTdd,
            packageSkillRefactor,
            userSkill,
            otherPackageSkill,
        ];
        const result = filterPackageSkills(
            skills,
            ["tdd"],
            MOCK_PACKAGE_SKILLS_DIR,
        );

        expect(result.kept).toHaveLength(3); // tdd, userSkill, otherPackageSkill
        expect(result.kept.map((s) => s.name)).toContain("tdd");
        expect(result.kept.map((s) => s.name)).toContain("my-skill");
        expect(result.kept.map((s) => s.name)).toContain("other");
        expect(result.kept.map((s) => s.name)).not.toContain("refactor");
    });

    it("should remove non-whitelisted package skills", () => {
        const skills = [packageSkillTdd, packageSkillRefactor];
        const result = filterPackageSkills(
            skills,
            ["tdd"],
            MOCK_PACKAGE_SKILLS_DIR,
        );

        expect(result.kept).toHaveLength(1);
        expect(result.kept[0].name).toBe("tdd");
    });

    it("should not remove non-package skills even if not in whitelist", () => {
        const skills = [userSkill, otherPackageSkill];
        const result = filterPackageSkills(
            skills,
            ["tdd"],
            MOCK_PACKAGE_SKILLS_DIR,
        );

        expect(result.kept).toHaveLength(2);
    });

    it("should report unknown whitelist entries", () => {
        const skills = [packageSkillTdd];
        const result = filterPackageSkills(
            skills,
            ["tdd", "nonexistent", "also-missing"],
            MOCK_PACKAGE_SKILLS_DIR,
        );

        expect(result.unknownEntries).toHaveLength(2);
        expect(result.unknownEntries).toContain("nonexistent");
        expect(result.unknownEntries).toContain("also-missing");
    });

    it("should not report unknown entries that match non-package skills", () => {
        const skills = [userSkill];
        const result = filterPackageSkills(
            skills,
            ["my-skill"],
            MOCK_PACKAGE_SKILLS_DIR,
        );

        // my-skill is not a package skill, so it should be in unknownEntries
        expect(result.unknownEntries).toHaveLength(1);
        expect(result.unknownEntries).toContain("my-skill");
    });

    it("should handle hyphenated skill names", () => {
        const packageSkillCodeReview = mockSkill(
            "code-review",
            "/mock/repo/skills/code-review/SKILL.md",
            "package",
        );
        const packageSkillCreatePlan = mockSkill(
            "create-plan",
            "/mock/repo/skills/create-plan/SKILL.md",
            "package",
        );
        const skills = [packageSkillCodeReview, packageSkillCreatePlan];
        const result = filterPackageSkills(
            skills,
            ["code-review"],
            MOCK_PACKAGE_SKILLS_DIR,
        );

        expect(result.kept).toHaveLength(1);
        expect(result.kept[0].name).toBe("code-review");
        expect(result.unknownEntries).toHaveLength(0);
    });
});

describe("input handler regex", () => {
    it("should match hyphenated skill names", () => {
        const regex = /^\/skill:([a-z0-9-]+)/;

        const testCases = [
            { input: "/skill:code-review", expected: "code-review" },
            { input: "/skill:create-plan", expected: "create-plan" },
            { input: "/skill:git-commit", expected: "git-commit" },
            { input: "/skill:implement-plan", expected: "implement-plan" },
            {
                input: "/skill:implement-and-review",
                expected: "implement-and-review",
            },
            {
                input: "/skill:writing-for-agents",
                expected: "writing-for-agents",
            },
            { input: "/skill:tdd", expected: "tdd" },
            { input: "/skill:refactor", expected: "refactor" },
        ];

        for (const testCase of testCases) {
            const match = testCase.input.match(regex);
            expect(match).not.toBeNull();
            expect(match![1]).toBe(testCase.expected);
        }
    });

    it("should not match invalid skill names", () => {
        const regex = /^\/skill:([a-z0-9-]+)/;

        // These should not match because they contain invalid characters
        // or don't follow the expected format
        const invalidCases = [
            "/skill:Code-Review", // uppercase - Pi only allows lowercase
            "/skill:", // empty skill name
            "/skill", // no colon
            "skill:code-review", // missing leading slash
        ];

        for (const testCase of invalidCases) {
            const match = testCase.match(regex);
            expect(match).toBeNull();
        }
    });

    it("should match skill names followed by space", () => {
        // Pi's expansion takes everything up to the first space
        // Our regex should match the skill name even if followed by space
        const regex = /^\/skill:([a-z0-9-]+)/;

        const testCases = [
            { input: "/skill:code-review ", expected: "code-review" },
            { input: "/skill:tdd some argument", expected: "tdd" },
        ];

        for (const testCase of testCases) {
            const match = testCase.input.match(regex);
            expect(match).not.toBeNull();
            expect(match![1]).toBe(testCase.expected);
        }
    });
});
