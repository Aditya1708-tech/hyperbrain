import mongoose from 'mongoose';

// Program Schema (e.g. BCA, BTech CSE, Class 12 CBSE)
export const ProgramSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true, index: true },
  displayName: { type: String, required: true },
  description: { type: String, default: '' },
  category: { type: String, default: 'Undergraduate Degrees' },
  duration: { type: String, default: '3 Years' },
  eligibility: { type: String, default: '10+2' },
  status: { type: String, enum: ['draft', 'published', 'archived'], default: 'published' },
  version: { type: Number, default: 1 }
}, { timestamps: true });

// Subject Schema (e.g. Operating Systems, Data Structures, Calculus)
export const SubjectSchema = new mongoose.Schema({
  programId: { type: String, index: true },
  semesterNumber: { type: Number, default: 1 },
  slug: { type: String, required: true, index: true },
  displayName: { type: String, required: true },
  description: { type: String, default: '' },
  unitsCount: { type: Number, default: 0 },
  status: { type: String, default: 'published' }
}, { timestamps: true });

// Unit & Topic Schema
export const TopicSchema = new mongoose.Schema({
  subjectId: { type: String, required: true, index: true },
  unitNumber: { type: Number, default: 1 },
  unitTitle: { type: String, default: '' },
  chapterNumber: { type: Number, default: 1 },
  slug: { type: String, required: true, index: true },
  displayName: { type: String, required: true },
  description: { type: String, default: '' },
  summary: { type: String, default: '' },
  keyConcepts: [{ type: String }],
  learningOutcomes: [{ type: String }],
  difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], default: 'Medium' }
}, { timestamps: true });

// Course Workspace Schema (User's customized course/subject hub)
export const CourseWorkspaceSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  subject_name: { type: String, required: true },
  program: { type: String, default: '' },
  syllabus: { type: mongoose.Schema.Types.Mixed, default: {} },
  chapters: [{
    chapterNumber: Number,
    title: String,
    description: String,
    difficulty: String,
    completed: { type: Boolean, default: false },
    summary: String
  }],
  notes: { type: String, default: '' },
  files: [{
    name: String,
    size: Number,
    uploadedAt: { type: Date, default: Date.now }
  }],
  progress: { type: Number, default: 0 },
  isArchived: { type: Boolean, default: false }
}, { timestamps: true });

export const Program = mongoose.models.Program || mongoose.model('Program', ProgramSchema);
export const Subject = mongoose.models.Subject || mongoose.model('Subject', SubjectSchema);
export const Topic = mongoose.models.Topic || mongoose.model('Topic', TopicSchema);
export const CourseWorkspace = mongoose.models.CourseWorkspace || mongoose.model('CourseWorkspace', CourseWorkspaceSchema);
