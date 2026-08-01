// Synthetic test book catalog covering the scenarios the app needs to render
// and reason about correctly. Mirrors the shape getBooks()/bookCardHtml()
// expect on the wire, not the raw sheet row format.

export const TEST_BOOKS = [
  {
    bookNo: 'E0001',
    bookName: 'The Gruffalo',
    author: 'Julia Donaldson',
    category: 'Picture Book',
    language: 'english',
    ageGroup: '3-5',
    status: 'Available',
    hidden: false,
    imageUrl: 'https://drive.google.com/thumbnail?id=fake-e0001&sz=w400'
  },
  {
    bookNo: 'M0001',
    bookName: 'Franklin chi christmas bhet',
    author: 'Paulette Bourgeois & Brenda Clark',
    category: 'Story Book',
    language: 'marathi',
    ageGroup: '3-7',
    status: 'Available',
    hidden: false,
    // Deliberately the busy/light cover that caused the hover-overlay
    // legibility bug (see test/fixtures/images/cover-busy-light.svg).
    imageUrl: 'https://drive.google.com/thumbnail?id=fake-m0001&sz=w400'
  },
  {
    bookNo: 'E0002',
    bookName: 'Matilda',
    author: 'Roald Dahl',
    category: 'Fiction',
    language: 'english',
    ageGroup: '8-12',
    status: 'Reserved',
    hidden: false,
    reservationId: 'R-1001',
    reservedCustomerId: 'C001',
    isMyReservation: false,
    imageUrl: ''
  },
  {
    bookNo: 'E0003',
    bookName: 'Charlotte’s Web',
    author: 'E.B. White',
    category: 'Fiction',
    language: 'english',
    ageGroup: '5-8',
    status: 'Issued',
    hidden: false,
    issuedTo: 'Test Parent',
    imageUrl: ''
  },
  {
    bookNo: 'E0004',
    bookName: 'A Book With No Cover At All',
    author: 'Unknown Author',
    category: 'Fiction',
    language: 'english',
    ageGroup: 'All ages',
    status: 'Available',
    hidden: false,
    imageUrl: ''
  },
  {
    bookNo: 'E0005',
    bookName: 'Hidden From Public View',
    author: 'Admin Only',
    category: 'Fiction',
    language: 'english',
    ageGroup: '5-8',
    status: 'Available',
    hidden: true,
    imageUrl: ''
  }
];

export function findTestBook(bookNo) {
  const book = TEST_BOOKS.find(b => b.bookNo === bookNo);
  if (!book) throw new Error(`No fixture book with bookNo ${bookNo}`);
  return { ...book };
}

// Fresh deep-ish copies so tests can mutate without cross-test bleed.
export function cloneTestBooks() {
  return TEST_BOOKS.map(b => ({ ...b }));
}

export const TEST_CUSTOMERS = [
  {
    customerId: 'C001',
    name: 'Active Parent',
    email: 'active.parent@example.com',
    phone: '9876543210',
    accountStatus: 'Active',
    subscriptionPlan: '5 books/month',
    monthlyReservationLimit: 5
  },
  {
    customerId: 'C002',
    name: 'Pending Parent',
    email: 'pending.parent@example.com',
    phone: '9123456780',
    accountStatus: 'Pending',
    subscriptionPlan: '',
    monthlyReservationLimit: 0
  },
  {
    customerId: 'C003',
    name: 'Plan Text Only Parent',
    email: 'plan.text@example.com',
    phone: '9988776655',
    accountStatus: 'Active',
    subscriptionPlan: '12 books/month',
    monthlyReservationLimit: null
  }
];
