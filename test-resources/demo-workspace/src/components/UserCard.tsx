import React from 'react';

interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

export function UserCard({ user }: { user: User }) {
  return (
    <div className="user-card">
      {user.avatarUrl && <img src={user.avatarUrl} alt={user.name} />}
      <div className="user-card__info">
        <h3>{user.name}</h3>
        <p>{user.email}</p>
      </div>
    </div>
  );
}
