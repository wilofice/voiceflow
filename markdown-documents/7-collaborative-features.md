# Task 7: Build Collaborative Features

## Input
- Transcript data
- User/team accounts

## Output
- Public/private sharing links
- Comments and suggestions on transcripts
- Team workspaces and permissions

## Guidelines
- Implement sharing via unique links with permissions
- Add comments and suggestions to transcript segments
- Build team management UI and backend
- Support real-time collaboration (WebSocket or polling)
- Add approval workflows and templates

## Functional Tests Validation
- [ ] Share transcript and access with correct permissions (mock: 2 users)
- [ ] Add/view comments and suggestions
- [ ] Team members can edit/view as per role
- [ ] Real-time updates visible to all collaborators
- [ ] Approval workflow works as expected
- [ ] Error shown if permission denied

## Unit Testing Guidelines
- Test sharing link generation and permission checks
- Test comment/suggestion logic
- Test team management backend and UI
- Test real-time update mechanism
