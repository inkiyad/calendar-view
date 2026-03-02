const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 5050;

app.use(cors());
app.use(express.json());

// Calendar events endpoint
app.get('/api/calendar', (req, res) => {
  res.json({
    organization: 'My Organization',
    events: [
      {
        date: '2026-03-01',
        title: 'Spring Kickoff',
        time: '10:00 AM',
        location: 'Main Hall',
        description: 'Annual spring kickoff meeting for all staff.',
        category: 'Meeting',
        color: '#2d6a4f',
        image: 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=600&auto=format&fit=crop'
      },
      {
        date: '2026-03-05',
        title: 'Workshop: Design Systems',
        time: '2:00 PM',
        location: 'Room 204',
        description: 'Hands-on design systems workshop open to all team members.',
        category: 'Workshop',
        color: '#1d3557',
        image: 'https://images.unsplash.com/photo-1558403194-611308249627?w=600&auto=format&fit=crop'
      },
      {
        date: '2026-03-05',
        title: 'Team Lunch',
        time: '12:00 PM',
        location: 'Cafeteria',
        description: 'Monthly team lunch. All are welcome!',
        category: 'Social',
        color: '#e07a5f'
      },
      {
        date: '2026-03-12',
        title: 'Board Meeting',
        time: '9:00 AM',
        location: 'Conference Room A',
        description: 'Quarterly board meeting to review organizational progress.',
        category: 'Meeting',
        color: '#2d6a4f'
      },
      {
        date: '2026-03-18',
        title: 'Fundraiser Gala',
        time: '6:00 PM',
        location: 'Grand Ballroom',
        description: 'Annual fundraiser gala dinner. Formal attire required.',
        category: 'Event',
        color: '#c77dff',
        image: 'https://images.unsplash.com/photo-1519671282429-b44660ead0a7?w=600&auto=format&fit=crop'
      },
      {
        date: '2026-03-22',
        title: 'Volunteer Day',
        time: '8:00 AM',
        location: 'City Park',
        description: 'Community volunteer day. Bring friends and family!',
        category: 'Community',
        color: '#f4a261',
        image: 'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?w=600&auto=format&fit=crop'
      },
      {
        date: '2026-03-28',
        title: 'Closing Ceremony',
        time: '5:00 PM',
        location: 'Auditorium',
        description: 'End of quarter closing ceremony for staff and stakeholders.',
        category: 'Event',
        color: '#1d3557'
      }
    ]
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
