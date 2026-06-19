/**
 * @typedef {"station" | "summit"} CheckpointType
 * @typedef {"exercise" | "quiz" | "coach" | "topic"} TaskType
 * @typedef {"left" | "right"} CheckpointSide
 *
 * @typedef {Object} Badge
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string} image
 * @property {boolean} unlocked
 *
 * @typedef {Object} Reward
 * @property {string} id
 * @property {string} title
 * @property {string} subtitle
 * @property {string} icon
 * @property {string} theme
 * @property {number} [xu]
 * @property {number} [exp]
 * @property {string | null} [badgeId]
 *
 * @typedef {Object} Task
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {string} targetRoute
 * @property {boolean} completed
 * @property {TaskType} [type]
 * @property {string} [icon]
 *
 * @typedef {Object} CheckpointPosition
 * @property {number} left
 * @property {number} top
 * @property {CheckpointSide} side
 *
 * @typedef {Object} Checkpoint
 * @property {string} id
 * @property {string} title
 * @property {CheckpointType} type
 * @property {CheckpointPosition} position
 * @property {Reward} reward
 * @property {Task[]} tasks
 * @property {boolean} completed
 *
 * @typedef {Object} Mountain
 * @property {string} id
 * @property {string} name
 * @property {string} image
 * @property {Badge} badge
 * @property {boolean} locked
 * @property {Checkpoint[]} checkpoints
 * @property {string} continent
 * @property {string} height
 * @property {string} description
 * @property {string} backgroundImage
 *
 * @typedef {Object} Season
 * @property {string} id
 * @property {number} order
 * @property {string} name
 * @property {string} title
 * @property {string} description
 * @property {Badge} badge
 * @property {Mountain[]} mountains
 *
 * @typedef {Object} LearningPathProgress
 * @property {string} currentSeason
 * @property {string} currentMountain
 * @property {string} currentCheckpoint
 * @property {string[]} completedTasks
 * @property {number} earnedXu
 * @property {number} earnedExp
 * @property {string[]} earnedBadges
 * @property {string[]} completedCheckpoints
 */

export {};
