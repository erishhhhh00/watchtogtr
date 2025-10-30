import { useRoomStore } from '../stores/roomStore';
import { socketService } from '../services/socket';

function ParticipantsList() {
  const { participants, isHost } = useRoomStore();
  const { room } = useRoomStore();

  const handleKick = (userId: string) => {
    if (isHost && room && window.confirm('Kick this user?')) {
      socketService.kickUser(room.id, userId);
    }
  };

  return (
    <div className="bg-darker rounded-lg p-4 shadow-lg">
      <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
        Participants ({participants.length})
        <span className="text-pink-400 text-xs">💕</span>
      </h3>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {participants.map((participant) => (
          <div
            key={participant.userId}
            className="flex items-center justify-between p-2 bg-dark rounded-lg"
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white font-semibold">
                {participant.username.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-white text-sm font-medium">
                  {participant.username}
                  {participant.isHost && (
                    <span className="ml-2 text-xs bg-secondary px-2 py-0.5 rounded">
                      Host
                    </span>
                  )}
                </p>
              </div>
            </div>
            {isHost && !participant.isHost && (
              <button
                onClick={() => handleKick(participant.userId)}
                className="text-red-500 hover:text-red-400 text-xs"
              >
                Kick
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default ParticipantsList;
