import React from 'react';
import { View, Text } from 'react-native';
import { Square, CheckSquare } from 'lucide-react-native';
import { notesStyles as styles } from './notesStyles';

const NoteCard = ({ note }) => {
  const isChecklist = note.type === 'checklist';

  return (
    <View style={styles.noteCard}>
      {note.title && <Text style={styles.noteTitle}>{note.title}</Text>}

      {isChecklist ? (
        <View>
          {note.items.map(item => (
            <View key={item.id} style={styles.listItem}>
              {item.done ? (
                <CheckSquare size={20} color="#5a3e2b" />
              ) : (
                <Square size={20} color="#5a3e2b" />
              )}
              <Text
                style={[
                  styles.listItemText,
                  item.done && styles.listItemTextDone,
                ]}
              >
                {item.text}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.noteContent}>{note.content}</Text>
      )}
    </View>
  );
};

export default NoteCard;
