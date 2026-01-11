import { useState, useEffect } from "react";
import { Box, Button, VStack, Heading, Flex } from "@chakra-ui/react";

type ViewMode = "control" | "devices" | "cues" | "cue-builder" | "cue-lists" | "cue-list-builder" | "shows" | "show-builder";

interface SidebarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onExpandedChange?: (expanded: boolean) => void;
}

interface MenuItem {
  id: ViewMode;
  label: string;
  icon: string;
}

const menuItems: MenuItem[] = [
  { id: "control", label: "Single Device Control", icon: "⚡" },
  { id: "devices", label: "Multi-Device Manager", icon: "📱" },
  { id: "shows", label: "Shows", icon: "🎭" },
  { id: "cues", label: "Cues", icon: "🎬" },
  { id: "cue-lists", label: "Cue Lists", icon: "📋" },
];

export function Sidebar({ viewMode, onViewModeChange, onExpandedChange }: SidebarProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    onExpandedChange?.(isExpanded);
  }, [isExpanded, onExpandedChange]);

  const toggleSidebar = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <>
      {/* Backdrop overlay for mobile when expanded */}
      {isExpanded && (
        <Box
          position="fixed"
          inset={0}
          bg="blackAlpha.500"
          zIndex={40}
          display={{ base: "block", md: "none" }}
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <Box
        as="aside"
        position="fixed"
        left={0}
        top={0}
        h="100vh"
        bg="gray.800"
        borderRight="1px"
        borderColor="gray.700"
        zIndex={50}
        w={isExpanded ? "256px" : "64px"}
        transition="all 0.3s ease-in-out"
      >
        {/* Toggle Button */}
        <Flex
          align="center"
          justify="space-between"
          h={16}
          px={4}
          borderBottom="1px"
          borderColor="gray.700"
        >
          {isExpanded && (
            <Heading as="h2" size="md" color="white">
              Menu
            </Heading>
          )}
          <Button
            onClick={toggleSidebar}
            variant="ghost"
            p={2}
            color="gray.300"
            _hover={{ bg: "gray.700", color: "white" }}
            aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
          >
            {isExpanded ? "←" : "☰"}
          </Button>
        </Flex>

        {/* Menu Items */}
        <Box as="nav" mt={4}>
          <VStack gap={1} px={2} align="stretch">
            {menuItems.map((item) => {
              const isActive = viewMode === item.id;
              return (
                <Button
                  key={item.id}
                  onClick={() => {
                    onViewModeChange(item.id);
                    // Auto-collapse on mobile after selection
                    if (window.innerWidth < 768) {
                      setIsExpanded(false);
                    }
                  }}
                  w="full"
                  justifyContent="flex-start"
                  gap={3}
                  px={3}
                  py={3}
                  variant={isActive ? "solid" : "ghost"}
                  colorScheme={isActive ? "blue" : "gray"}
                  title={!isExpanded ? item.label : undefined}
                >
                  <Box fontSize="2xl">{item.icon}</Box>
                  {isExpanded && item.label}
                </Button>
              );
            })}
          </VStack>
        </Box>
      </Box>
    </>
  );
}

