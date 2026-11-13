export const DEMO_COURSES = [
  {
    id: 'course-ml',
    title: 'Machine Learning Foundations',
    category: 'AI & Data',
    level: 'Beginner',
    duration: '3 weeks',
    accent: 'blue',
    description: 'A short introduction to supervised learning, evaluation, and responsible validation.',
    lessons: [
      { id: 'ml-01', title: 'Learning from examples', minutes: 8, summary: 'How labeled examples help a model learn a mapping.', content: 'In supervised learning, each training example pairs an input with a target label. A model adjusts its parameters to reduce errors on the training examples, then must be checked on data it did not train on.' },
      { id: 'ml-02', title: 'Train, validation, and test sets', minutes: 10, summary: 'Why datasets are split before model evaluation.', content: 'Use training data to fit parameters, validation data to compare choices, and a held-out test set for a final estimate. Keep related or duplicate samples together when splitting so the test set remains genuinely unseen.' },
      { id: 'ml-03', title: 'Reading classification metrics', minutes: 9, summary: 'Accuracy, precision, recall, and F1 answer different questions.', content: 'Accuracy is the fraction of correct predictions. Precision measures how often predicted positives are correct; recall measures how many actual positives were found. F1 is their harmonic mean. Per-class metrics help reveal failures hidden by an overall score.' },
    ],
  },
  {
    id: 'course-web',
    title: 'Web Engineering Basics',
    category: 'Web Development',
    level: 'Beginner',
    duration: '2 weeks',
    accent: 'teal',
    description: 'A practical overview of semantic pages, HTTP requests, and small JSON APIs.',
    lessons: [
      { id: 'web-01', title: 'Structure with semantic HTML', minutes: 7, summary: 'Choose elements by meaning, not appearance.', content: 'Semantic HTML gives pages a useful structure for browsers, assistive technology, and maintainers. Use headings in order, labels for form controls, and buttons for actions.' },
      { id: 'web-02', title: 'The request and response cycle', minutes: 9, summary: 'How a browser and server exchange data.', content: 'A client sends an HTTP request with a method, path, headers, and sometimes a body. The server responds with a status code, headers, and a body such as HTML or JSON.' },
      { id: 'web-03', title: 'Designing a small API', minutes: 9, summary: 'Use resource paths, clear status codes, and validation.', content: 'A JSON API should validate input, return consistent error objects, and use HTTP status codes that match the outcome. Never trust values just because they came from a browser form.' },
    ],
  },
  {
    id: 'course-db',
    title: 'Relational Database Essentials',
    category: 'Databases',
    level: 'Beginner',
    duration: '2 weeks',
    accent: 'orange',
    description: 'Model related data with tables, keys, constraints, and parameterized queries.',
    lessons: [
      { id: 'db-01', title: 'Tables and relationships', minutes: 8, summary: 'Represent entities and their relationships.', content: 'A relational schema stores each kind of entity in a table. Primary keys identify rows, while foreign keys connect related rows and help keep references valid.' },
      { id: 'db-02', title: 'Constraints protect data', minutes: 8, summary: 'Use uniqueness and foreign keys to enforce rules.', content: 'Unique constraints prevent duplicate values where they are not allowed. Foreign keys prevent child records from referencing missing parent records.' },
      { id: 'db-03', title: 'Parameterized SQL', minutes: 8, summary: 'Keep user input separate from query text.', content: 'Pass user values as query parameters instead of concatenating them into SQL strings. This keeps data and SQL syntax separate and helps prevent injection.' },
    ],
  },
  {
    id: 'course-net',
    title: 'Computer Networks Primer',
    category: 'Networking',
    level: 'Beginner',
    duration: '2 weeks',
    accent: 'purple',
    description: 'A concise guide to IP addressing, DNS, transport protocols, and HTTPS.',
    lessons: [
      { id: 'net-01', title: 'Addresses and DNS', minutes: 8, summary: 'How names resolve to network addresses.', content: 'IP addresses identify network interfaces for packet delivery. DNS lets applications look up records associated with human-readable domain names.' },
      { id: 'net-02', title: 'TCP and UDP', minutes: 8, summary: 'Two transport protocols with different trade-offs.', content: 'TCP provides an ordered byte stream with retransmission and flow control. UDP sends datagrams without those delivery guarantees, which can suit applications that manage timing or recovery themselves.' },
      { id: 'net-03', title: 'HTTPS in brief', minutes: 9, summary: 'TLS protects a web connection in transit.', content: 'HTTPS uses TLS to authenticate the server and protect data in transit. It does not by itself make an application safe from bugs or authorize every request.' },
    ],
  },
];

export function cloneCourses(courses = DEMO_COURSES) {
  return structuredClone(courses);
}
